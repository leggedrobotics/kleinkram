import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import QueueEntity from '@common/entities/queue/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
    FindOptionsWhere,
    In,
    LessThan,
    Like,
    MoreThan,
    Repository,
} from 'typeorm';
import { DriveCreate } from '@common/api/types/drive-create.dto';
import Mission from '@common/entities/mission/mission.entity';
import Worker from '@common/entities/worker/worker.entity';
import {
    ActionState,
    FileLocation,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import logger from '../logger';
import { UserService } from './user.service';
import FileEntity from '@common/entities/file/file.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import Action from '@common/entities/action/action.entity';
import { RuntimeDescription } from '@common/types';

import Queue from 'bull';
import { addActionQueue } from '@common/schedulingLogic';
import {
    getBucketFromFileType,
    getInfoFromMinio,
    internalMinio,
} from '@common/minio_helper';
import { redis } from '@common/consts';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import User from '@common/entities/user/user.entity';
import {
    FileQueueEntriesDto,
    FileQueueEntryDto,
} from '@common/api/types/FileQueueEntry.dto';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';

function extractFileIdFromUrl(url: string): string | null {
    // Define the regex patterns for file and folder IDs, now including optional /u/[number]/ segments
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;

    // Test the URL against the file pattern
    let match = filePattern.exec(url);
    if (match?.[1]) {
        return match[1];
    }

    // Test the URL against the folder pattern
    match = folderPattern.exec(url);
    if (match?.[1]) {
        return match[1];
    }

    // Return null if no match is found
    return null;
}

@Injectable()
export class QueueService implements OnModuleInit {
    private actionQueues!: Record<string, Queue.Queue>;
    private fileQueue!: Queue.Queue;

    constructor(
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private userService: UserService,
        @InjectRepository(Worker)
        private workerRepository: Repository<Worker>,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectMetric('backend_online_workers')
        private onlineWorkers: Gauge,
        @InjectMetric('backend_pending_jobs')
        private pendingJobs: Gauge,
        @InjectMetric('backend_active_jobs')
        private activeJobs: Gauge,
        @InjectMetric('backend_completed_jobs')
        private completedJobs: Gauge,
        @InjectMetric('backend_failed_jobs')
        private failedJobs: Gauge,
    ) {}

    async onModuleInit(): Promise<void> {
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

                    await this.actionQueues[worker.identifier]?.isReady();
                }),
            );
        } catch (error) {
            logger.error(error);
        }
        await Promise.all(
            Object.values(this.actionQueues).map(async (queue) => {
                logger.debug(
                    `Waiting for ${queue.name} to be ready. Is ${queue.client.status}`,
                );
                await queue.isReady();
            }),
        );
        logger.debug('All queues are ready');
    }

    async importFromDrive(driveCreate: DriveCreate, user: User) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        // @ts-ignore
        const creator = await this.userService.findOneByUUID(user.uuid);

        // get GoogleDrive file id
        const fileId = extractFileIdFromUrl(driveCreate.driveURL);
        if (!fileId) throw new ConflictException('Invalid Drive URL');

        const queueEntry = await this.queueRepository.save(
            this.queueRepository.create({
                identifier: fileId,

                display_name: `GoogleDrive Object (no id=${fileId})`,
                state: QueueState.AWAITING_PROCESSING,
                location: FileLocation.DRIVE,
                mission,
                creator,
            }),
        );
        await this.fileQueue
            .add('processDriveFile', { queueUuid: queueEntry.uuid })
            .catch((error: unknown) => logger.error(error));
        logger.debug('added to queue');
    }

    async confirmUpload(uuid: string, md5: string): Promise<void> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { identifier: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state !== QueueState.AWAITING_UPLOAD) {
            throw new ConflictException('File is not in uploading state');
        }
        const file = await this.fileRepository.findOneOrFail({
            where: {
                uuid: uuid,
            },
        });

        const fileInfo = await getInfoFromMinio(file.type, file.uuid).catch(
            async () => {
                await this.fileRepository.remove(file);
                throw new ConflictException('File not found in Minio');
            },
        );
        if (fileInfo === null) throw new Error('File not found in Minio');
        if (file.state === FileState.UPLOADING) file.state = FileState.OK;
        file.size = fileInfo.size;
        await this.fileRepository.save(file);

        queue.state = QueueState.AWAITING_PROCESSING;
        await this.queueRepository.save(queue);

        await this.fileQueue.add('processMinioFile', {
            queueUuid: queue.uuid,
            md5,
        });
    }

    async active(
        startDate: Date,
        stateFilter: string,
        userUUID: string,
        skip: number,
        take: number,
    ) {
        // @ts-ignore
        const user = await this.userService.findOneByUUID(userUUID);
        const where: FindOptionsWhere<QueueEntity> = {
            updatedAt: MoreThan(startDate),
        };

        if (user.role === UserRole.ADMIN) {
            if (stateFilter) {
                const filter = stateFilter
                    .split(',')
                    .map((state) => Number.parseInt(state));
                where.state = In(filter);
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
                .map((state) => Number.parseInt(state));
            query.andWhere('queue.state IN (:...filter)', { filter });
        }
        return query.getMany();
    }

    async forFile(
        filename: string,
        missionUUID: string,
    ): Promise<FileQueueEntriesDto> {
        const entries: FileQueueEntryDto[] = await this.queueRepository
            .find({
                where: {
                    display_name: Like(`${filename}%`),
                    mission: { uuid: missionUUID },
                },
                relations: ['creator'],
            })
            .then((fileQueueEntries) =>
                fileQueueEntries
                    .map((queue: QueueEntity): FileQueueEntryDto | null => {
                        if (queue.creator === undefined) return null;

                        return {
                            filename: queue.display_name,
                            state: queue.state,
                            uuid: queue.uuid,
                            creator: {
                                uuid: queue.creator.uuid,
                                name: queue.creator.name,
                                avatarUrl: queue.creator.avatarUrl ?? '',
                            },
                            createdAt: queue.createdAt,
                            displayName: queue.display_name,
                            identifier: queue.identifier,
                            processingDuration: queue.processingDuration ?? 0,
                            updatedAt: queue.updatedAt,
                            location: queue.location,
                        };
                    })
                    .filter(
                        (entry): entry is FileQueueEntryDto => entry !== null,
                    ),
            );

        return {
            data: entries,
            count: entries.length,
            take: entries.length,
            skip: 0,
        };
    }

    async delete(missionUUID: string, queueUUID: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });
        if (
            queue.state >= QueueState.PROCESSING &&
            queue.state < QueueState.COMPLETED
        ) {
            throw new ConflictException('Cannot delete file while processing');
        }
        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) {
            logger.debug('Removing job:', jobToRemove.data.queueUuid);
            await jobToRemove.remove();
        } else {
            logger.debug('Job not found');
        }
        await this.queueRepository.remove(queue);

        const file = await this.fileRepository.findOne({
            where: { uuid: queue.identifier, mission: { uuid: missionUUID } },
        });
        if (!file) {
            return;
        }
        const minioBucket = getBucketFromFileType(file.type);
        try {
            await internalMinio.removeObject(minioBucket, file.uuid);
        } catch (error: any) {
            logger.log(error);
        }
        await this.fileRepository.remove(file);
        if (file.type === FileType.BAG) {
            const mcap = await this.fileRepository.findOne({
                where: {
                    uuid: queue.identifier,
                    mission: { uuid: missionUUID },
                },
            });
            if (mcap) {
                try {
                    await internalMinio.removeObject(
                        getBucketFromFileType(mcap.type),
                        mcap.uuid,
                    );
                } catch (error: any) {
                    logger.log(error);
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
        if (queue.state >= QueueState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }
        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) {
            logger.debug('Removing job:', jobToRemove.data.queueUuid);
            await jobToRemove.remove();
        } else {
            logger.debug('Job not found');
        }
        queue.state = QueueState.CANCELED;
        await this.queueRepository.save(queue);
    }

    async _addActionQueue(
        action: Action,
        runtimeRequirements: RuntimeDescription,
    ) {
        logger.debug(
            `Adding action to queue: ${action.template?.name ?? 'N/A'}`,
        );

        return await addActionQueue(
            action,
            runtimeRequirements,
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
        const jobs: Queue.Job[] = [];
        await Promise.all(
            Object.values(this.actionQueues).map(async (queue) => {
                if (queue.client.status !== 'ready') {
                    logger.error(`Queue ${queue.name} is not ready`);
                }
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
                const jobInfo: any = {};
                jobInfo.state = await job.getState();
                jobInfo.progress = await job.progress();
                jobInfo.timestamp = job.timestamp;
                jobInfo.name = job.name;
                jobInfo.id = job.id;
                return { job: jobInfo, action };
            }),
        );
    }

    async stopJob(jobId: string) {
        const action = await this.actionRepository.findOne({
            where: { uuid: jobId },
            relations: ['worker'],
        });

        if (action?.worker === undefined)
            throw new Error('No worker found for this action');

        action.state = ActionState.FAILED;
        await this.actionRepository.save(action);

        const job =
            await this.actionQueues[action.worker.identifier]?.getJob(jobId);
        if (!job) {
            throw new ConflictException('Job not found');
        }
        try {
            await job.remove();
        } catch (error: any) {
            logger.log(error);
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async healthCheck() {
        const workers = await this.workerRepository.find({
            where: {
                reachable: true,
                lastSeen: LessThan(new Date(Date.now() - 2 * 60 * 1000)),
            },
        });

        await Promise.all(
            workers.map(async (worker) => {
                if (this.actionQueues[worker.identifier]) {
                    logger.debug(`${worker.identifier} is now unreachable`);
                    worker.reachable = false;

                    await this.workerRepository.save(worker);
                    const actionQueue = this.actionQueues[worker.identifier];

                    if (actionQueue === undefined)
                        throw new Error('Action queue not found');

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
                                    await this.actionRepository.findOneOrFail({
                                        where: { uuid: job.data.uuid },
                                        relations: ['template'],
                                    });

                                if (action.template === undefined)
                                    throw new Error('Template not found');

                                try {
                                    await job.remove();
                                    const runtimeRequirements = {
                                        cpuCores: action.template.cpuCores,
                                        cpuMemory: action.template.cpuMemory,
                                        gpuMemory: action.template.gpuMemory,
                                        maxRuntime: action.template.maxRuntime,
                                    };

                                    await addActionQueue(
                                        action,
                                        runtimeRequirements,
                                        this.workerRepository,
                                        this.actionRepository,
                                        this.actionQueues,
                                        logger,
                                    );
                                } catch (error) {
                                    logger.error(error);
                                }
                            }),
                        );
                        if (this.actionQueues[worker.identifier]) {
                            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                            delete this.actionQueues[worker.identifier];
                        }
                    } catch (error) {
                        logger.error(error);
                        return;
                    }
                }
            }),
        );
        const activeWorker = await this.workerRepository.find({
            where: { reachable: true },
        });
        activeWorker.map((worker) => {
            if (!this.actionQueues[worker.identifier]) {
                this.actionQueues[worker.identifier] = new Queue(
                    `action-queue-${worker.identifier}`,
                    { redis },
                );
            }
        });

        this.onlineWorkers.set({}, activeWorker.length);
    }

    @Cron(CronExpression.EVERY_SECOND)
    async checkQueueState() {
        const actionQueues = Object.values(this.actionQueues);
        const jobCounts = await Promise.all(
            actionQueues.map(async (queue) => {
                return await queue.getJobCounts();
            }),
        );
        const jobsCount = await this.fileQueue.getJobCounts();

        this.pendingJobs.set(
            { queue: 'fileQueue' },
            jobsCount.waiting + jobsCount.delayed,
        );
        this.activeJobs.set({ queue: 'fileQueue' }, jobsCount.active);
        this.completedJobs.set({ queue: 'fileQueue' }, jobsCount.completed);
        this.failedJobs.set({ queue: 'fileQueue' }, jobsCount.failed);

        for (const [index, count] of jobCounts.entries()) {
            this.pendingJobs.set(
                { queue: actionQueues[index]?.name },
                count.waiting + count.delayed,
            );
            this.activeJobs.set(
                { queue: actionQueues[index]?.name },
                count.active,
            );
            this.completedJobs.set(
                { queue: actionQueues[index]?.name },
                count.completed,
            );
            this.failedJobs.set(
                { queue: actionQueues[index]?.name },
                count.failed,
            );
        }
    }
}
