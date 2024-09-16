import { ConflictException, Injectable } from '@nestjs/common';
import QueueEntity from '@common/entities/queue/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, MoreThan, Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Mission from '@common/entities/mission/mission.entity';
import { FileLocation, FileState, FileType, UserRole } from '@common/enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import env from '@common/env';
import { externalMinio, getInfoFromMinio, internalMinio } from '../minioHelper';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import { UserService } from '../user/user.service';
import { addAccessConstraints } from '../auth/authHelper';
import FileEntity from '@common/entities/file/file.entity';
import { SubmittedAction } from '@common/entities/action/action.entity';

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
export class QueueService {
    constructor(
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectQueue('file-queue') private fileProcessingQueue: Queue,
        @InjectQueue('action-queue') private actionQueue: Queue,
        private user_service: UserService,
    ) {}

    async addActionQueue(actionUUID: string) {
        await this.actionQueue.add(
            'actionProcessQueue',
            { uuid: actionUUID },
            {
                jobId: actionUUID,
                backoff: {
                    delay: 60 * 1_000, // 60 seconds
                    type: 'exponential',
                },
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 60, // one hour of attempts
            },
        );
    }

    async createDrive(driveCreate: DriveCreate, user: JWTUser) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.user_service.findOneByUUID(user.uuid);
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
        await this.fileProcessingQueue
            .add('processDriveFile', {
                queueUuid: newQueue.uuid,
            })
            .catch((err) => {
                logger.error(err);
            });
        logger.debug('added to queue');
    }

    async handleFileUpload(
        filenames: string[],
        missionUUID: string,
        user: JWTUser,
    ) {
        const creator = await this.user_service.findOneByUUID(user.uuid);
        const filenameRegex = /^[a-zA-Z0-9_\-\. \[\]\(\)äöüÄÖÜ]+$/;
        const filteredFilenames = filenames.filter(
            (filename) =>
                (filename.endsWith('.bag') || filename.endsWith('.mcap')) &&
                filenameRegex.test(filename),
        );
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });

        const expiry = 2 * 60 * 60;
        const urlPromises = filenames.map(async (filename) => {
            const fileType = filename.endsWith('.bag')
                ? FileType.BAG
                : FileType.MCAP;
            const location = `${mission.project.name}/${mission.name}/${filename}`;
            const tentativeFile = this.fileRepository.create({
                date: new Date(),
                size: 0,
                filename,
                mission,
                creator,
                type: fileType,
                tentative: true,
            });
            try {
                await this.fileRepository.save(tentativeFile);
                const minioURL = await externalMinio.presignedPutObject(
                    fileType === FileType.BAG
                        ? env.MINIO_BAG_BUCKET_NAME
                        : env.MINIO_MCAP_BUCKET_NAME,
                    location,
                    expiry,
                );
                const newQueue = this.queueRepository.create({
                    filename,
                    identifier: location,
                    state: FileState.AWAITING_UPLOAD,
                    location: FileLocation.MINIO,
                    mission,
                    creator,
                });
                await this.queueRepository.save(newQueue);
                return {
                    filename,
                    minioURL,
                    uuid: newQueue.uuid,
                };
            } catch (error) {
                return {
                    filename,
                    minioURL: null,
                    uuid: null,
                    error: 'Non-unique filename',
                };
            }
        });

        const urls = await Promise.all(urlPromises);
        return urls.reduce((acc, { filename, minioURL, uuid, error }) => {
            acc[filename] = { url: minioURL, uuid, error };
            return acc;
        }, {});
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

        await this.fileProcessingQueue.add('processMinioFile', {
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
        const waitingJobs = await this.fileProcessingQueue.getWaiting();
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
        console.log(queue.state);
        if (queue.state >= FileState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }
        const waitingJobs = await this.fileProcessingQueue.getWaiting();
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
}
