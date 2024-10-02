import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import QueueEntity from '@common/entities/queue/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Like, MoreThan, Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Mission from '@common/entities/mission/mission.entity';
import Worker from '@common/entities/worker/worker.entity';
import {
    ActionState,
    FileLocation,
    FileState,
    FileType,
    UserRole,
} from '@common/enum';
import env from '@common/env';
import { getInfoFromMinio, internalMinio } from '../minioHelper';
import logger from '../logger';
import { AuthRes } from '../auth/paramDecorator';
import { UserService } from '../user/user.service';
import { addAccessConstraints } from '../auth/authHelper';
import FileEntity from '@common/entities/file/file.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import Action from '@common/entities/action/action.entity';
import { RuntimeRequirements } from '@common/types';

import Queue from 'bull';
import { redis } from '../consts';
import { addActionQueue } from '@common/schedulingLogic';

function extractFileIdFromUrl(url: string): string | null {
    // Define the regex patterns for file and folder IDs, now including optional /u/[number]/ segments
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;

    // Test the URL against the file pattern
    let match = url.match(filePattern);
    if (match && match[1]) {
        return match[1];
    }

    // Test the URL against the folder pattern
    match = url.match(folderPattern);
    if (match && match[1]) {
        return match[1];
    }

    // Return null if no match is found
    return null;
}

@Injectable()
export class QueueService implements OnModuleInit {
    private actionQueues: Record<string, Queue.Queue>;
    private fileQueue: Queue.Queue;
    constructor(
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private user_service: UserService,
        @InjectRepository(Worker)
        private workerRepository: Repository<Worker>,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
    ) {}

    async onModuleInit() {
        this.fileQueue = new Queue('file-queue', {
            redis,
        });
        const availableWorker = await this.workerRepository.find({
            where: { reachable: true },
        });
        this.actionQueues = {};
        try {
            await Promise.all(
                availableWorker.map(async (worker) => {
                    this.actionQueues[worker.identifier] = new Queue(
                        `action-queue-${worker.identifier}`,
                        { redis },
                    );
                    await this.actionQueues[worker.identifier].isReady();
                }),
            );
        } catch (e) {
            console.error(e);
        }
    }

    async createDrive(driveCreate: DriveCreate, auth: AuthRes) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.user_service.findOneByUUID(auth.user.uuid);
        const fileId = extractFileIdFromUrl(driveCreate.driveURL);

        const newQueue = this.queueRepository.create({
            filename: fileId,
            identifier: fileId,
            state: FileState.AWAITING_PROCESSING,
            location: FileLocation.DRIVE,
            mission,
            creator,
        });
        await this.queueRepository.save(newQueue);
        await this.fileQueue
            .add('processDriveFile', {
                queueUuid: newQueue.uuid,
            })
            .catch((err) => {
                logger.error(err);
            });
        logger.debug('added to queue');
    }

    async confirmUpload(uuid: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state !== FileState.AWAITING_UPLOAD) {
            throw new ConflictException('File is not in uploading state');
        }
        const file = await this.fileRepository.findOneOrFail({
            where: {
                filename: queue.filename,
                mission: { uuid: queue.mission.uuid },
            },
        });

        const fileInfo = await getInfoFromMinio(
            queue.filename.endsWith('.bag') ? FileType.BAG : FileType.MCAP,
            `${queue.mission.project.name}/${queue.mission.name}/${queue.filename}`,
        ).catch(async (err) => {
            await this.fileRepository.remove(file);
            throw new ConflictException('File not found in Minio');
        });

        file.tentative = false;
        file.size = fileInfo.size;
        await this.fileRepository.save(file);

        queue.state = FileState.AWAITING_PROCESSING;
        await this.queueRepository.save(queue);

        await this.fileQueue.add('processMinioFile', {
            queueUuid: queue.uuid,
        });
    }

    async active(
        startDate: Date,
        stateFilter: string,
        userUUID: string,
        skip: number,
        take: number,
    ) {
        const user = await this.user_service.findOneByUUID(userUUID);
        const where = {
            updatedAt: MoreThan(startDate),
        };

        if (user.role === UserRole.ADMIN) {
            if (stateFilter) {
                const filter = stateFilter
                    .split(',')
                    .map((state) => parseInt(state));
                where['state'] = In(filter);
            }
            return await this.queueRepository.find({
                where,
                relations: ['mission', 'mission.project', 'creator'],
                skip,
                take,
                order: {
                    createdAt: 'DESC',
                },
            });
        }
        const query = addAccessConstraints(
            this.queueRepository
                .createQueryBuilder('queue')
                .leftJoinAndSelect('queue.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('queue.creator', 'creator')
                .where('queue.updatedAt > :startDate', { startDate }),
            userUUID,
        )
            .skip(skip)
            .take(take)
            .orderBy('queue.createdAt', 'DESC');

        if (stateFilter) {
            const filter = stateFilter
                .split(',')
                .map((state) => parseInt(state));
            query.andWhere('queue.state IN (:...filter)', { filter });
        }
        return query.getMany();
    }

    async forFile(filename: string, missionUUID: string) {
        return this.queueRepository.find({
            where: {
                filename: Like(`${filename}%`),
                mission: { uuid: missionUUID },
            },
            relations: ['creator'],
        });
    }

    async delete(missionUUID: string, queueUUID: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });
        if (
            queue.state >= FileState.PROCESSING &&
            queue.state < FileState.COMPLETED
        ) {
            throw new ConflictException('Cannot delete file while processing');
        }
        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (!jobToRemove) {
            logger.debug('Job not found');
        } else {
            console.log('Removing job:', jobToRemove.data.queueUuid);
            await jobToRemove.remove();
        }
        await this.queueRepository.remove(queue);

        const file = await this.fileRepository.findOne({
            where: { filename: queue.filename, mission: { uuid: missionUUID } },
        });
        if (!file) {
            return;
        }
        const minioPath = `${queue.mission.project.name}/${queue.mission.name}/${queue.filename}`;
        const minioBucket =
            file.type === FileType.BAG
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME;
        try {
            await internalMinio.removeObject(minioBucket, minioPath);
        } catch (err) {
            logger.log(err);
        }
        await this.fileRepository.remove(file);
        if (file.type === FileType.BAG) {
            const mcap = await this.fileRepository.findOne({
                where: {
                    filename: queue.filename.replace('.bag', '.mcap'),
                    mission: { uuid: missionUUID },
                },
            });
            if (mcap) {
                try {
                    await internalMinio.removeObject(
                        minioBucket,
                        minioPath.replace('.bag', '.mcap'),
                    );
                } catch (err) {
                    logger.log(err);
                }
                await this.fileRepository.remove(mcap);
            }
        }
    }

    async exists(missionUUID: string, queueUUID: string) {
        return this.queueRepository.exists({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
        });
    }

    async cancelProcessing(queueUUID: string, missionUUID: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });
        if (queue.state >= FileState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }
        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (!jobToRemove) {
            logger.debug('Job not found');
        } else {
            console.log('Removing job:', jobToRemove.data.queueUuid);
            await jobToRemove.remove();
        }
        queue.state = FileState.CANCELED;
        await this.queueRepository.save(queue);
    }

    async _addActionQueue(
        action: Action,
        runtime_requirements: RuntimeRequirements,
    ) {
        logger.debug(`Adding action to queue: ${action.template.name}`);

        return await addActionQueue(
            action,
            runtime_requirements,
            this.workerRepository,
            this.actionRepository,
            this.actionQueues,
            logger,
        );
    }

    async bullQueue() {
        const jobTypes: Queue.JobStatus[] = [
            'active',
            'delayed',
            'waiting',
            'completed',
            'failed',
            'paused',
        ];
        const jobs = [];
        await Promise.all(
            Object.values(this.actionQueues).map(async (queue) => {
                const _jobs = await queue.getJobs(jobTypes);
                jobs.push(..._jobs);
            }),
        );
        return await Promise.all(
            jobs.map(async (job) => {
                const action = await this.actionRepository.findOne({
                    where: { uuid: job.id as string },
                    relations: ['template'],
                });
                return { job, action };
            }),
        );
    }

    async stopJob(jobId: string) {
        const action = await this.actionRepository.findOne({
            where: { uuid: jobId },
            relations: ['worker'],
        });
        if (action) {
            action.state = ActionState.FAILED;
            await this.actionRepository.save(action);

            const job =
                await this.actionQueues[action.worker.identifier].getJob(jobId);
            if (!job) {
                throw new ConflictException('Job not found');
            }
            try {
                await job.remove();
            } catch (err) {
                logger.log(err);
            }
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async healthCheck() {
        const workers = await this.workerRepository.find({
            where: {
                reachable: true,
                lastSeen: LessThan(
                    new Date(new Date().getTime() - 2 * 60 * 1000),
                ),
            },
        });

        await Promise.all(
            workers.map(async (worker) => {
                if (this.actionQueues[worker.identifier]) {
                    const actionQueue = this.actionQueues[worker.identifier];
                    try {
                        logger.debug('beforeJobGetting');
                        const waitingJobs = await actionQueue.getJobs([
                            'active',
                            'delayed',
                            'waiting',
                        ]);

                        logger.debug('waiting Jobs', waitingJobs);
                        await Promise.all(
                            waitingJobs.map(async (job) => {
                                const action =
                                    await this.actionRepository.findOne({
                                        where: { uuid: job.data.uuid },
                                        relations: ['template'],
                                    });
                                try {
                                    await job.remove();
                                    await addActionQueue(
                                        action,
                                        action.template.runtime_requirements,
                                        this.workerRepository,
                                        this.actionRepository,
                                        this.actionQueues,
                                        logger,
                                    );
                                } catch (e) {
                                    logger.error(e);
                                }
                            }),
                        );
                    } catch (e) {
                        logger.error(e);
                        console.log('error');
                        return;
                    }
                }
                logger.debug(`${worker.identifier} is now unreachable`);
                worker.reachable = false;
                if (this.actionQueues[worker.identifier]) {
                    delete this.actionQueues[worker.identifier];
                }
                await this.workerRepository.save(worker);
            }),
        );
        const activeWorker = await this.workerRepository.find({
            where: { reachable: true },
        });
        activeWorker.map((worker) => {
            if (!this.actionQueues[worker.identifier]) {
                this.actionQueues[worker.identifier] = new Queue(
                    `action-queue-${worker.identifier}`,
                );
            }
        });
    }
}
