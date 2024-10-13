import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import {
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import { Job, Queue } from 'bull';
import {
    AccessGroupRights,
    FileLocation,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/enum';
import QueueEntity from '@common/entities/queue/queue.entity';
import User from '@common/entities/user/user.entity';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import logger from '../logger';
import Redlock, { ResourceLockedError } from 'redlock';
import { Redis } from 'ioredis';
import { redis, systemUser } from '@common/consts';
import { Cron, CronExpression } from '@nestjs/schedule';
import env from '@common/env';
import { internalMinio } from '@common/minio_helper';
import crypto from 'crypto';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock: Redlock;
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
    ) {}

    async onModuleInit() {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Process({ concurrency: 10, name: 'cancelUpload' })
    async process(job: CancelUploadJob) {
        const userUUID = job.data.userUUID;
        const uuids = job.data.uuids;
        const missionUUID = job.data.missionUUID;
        const canCancelUpload = await this.canCancelUpload(
            userUUID,
            missionUUID,
        );
        if (!canCancelUpload) {
            logger.debug(`User ${userUUID} can't cancel upload`);
            return;
        }
        await Promise.all(
            uuids.map(async (uuid) => {
                const file = await this.fileRepository.findOne({
                    where: { uuid, mission: { uuid: missionUUID } },
                    relations: ['mission'],
                });
                if (!file) {
                    return;
                }
                if (file.state === FileState.OK) {
                    return;
                }
                const queue = await this.queueRepository.findOne({
                    where: {
                        display_name: file.filename,
                        mission: { uuid: file.mission.uuid },
                    },
                });
                queue.state = QueueState.CANCELED;
                await this.queueRepository.save(queue);
                await this.fileRepository.remove(file);
                return;
            }),
        );
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async fixFileHashes() {
        const files = await this.fileRepository.find({
            where: { hash: IsNull(), state: Not(FileState.LOST) },
            relations: ['mission', 'mission.project'],
        });
        for (const file of files) {
            await this.redlock.using(
                [`lock:hash-repair-${file.uuid}`],
                10000,
                async () => {
                    const hash = crypto.createHash('md5');

                    const datastream = await internalMinio.getObject(
                        file.type === FileType.BAG
                            ? env.MINIO_BAG_BUCKET_NAME
                            : env.MINIO_MCAP_BUCKET_NAME,
                        `${file.mission.project.name}/${file.mission.name}/${file.filename}`,
                    );
                    await new Promise((resolve, reject) => {
                        datastream.on('error', (err) => {
                            logger.error(err);
                            resolve(void 0);
                        });
                        datastream.on('data', (chunk) => {
                            hash.update(chunk);
                        });
                        datastream.on('end', async () => {
                            file.hash = hash.digest('base64');
                            await this.fileRepository.save(file);
                            resolve(void 0);
                        });
                    });
                },
            );
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanupFailedUploads() {
        await this.redlock.using(
            [`lock:cleanup-failed-uploads`],
            10000,
            async () => {
                const failedUploads = await this.fileRepository.find({
                    where: {
                        state: FileState.UPLOADING,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    failedUploads.map(async (file) => {
                        file.state = FileState.ERROR;
                        await this.fileRepository.save(file);
                        const queue = await this.queueRepository.findOne({
                            where: {
                                display_name: file.filename,
                                mission: { uuid: file.mission.uuid },
                            },
                        });
                        if (queue) {
                            queue.state = QueueState.ERROR;
                            await this.queueRepository.save(queue);
                        }
                    }),
                );
            },
        );
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async synchronizeFileSystem() {
        try {
            await this.redlock.using([`lock:fs-sync`], 10000, async () => {
                const result = await this.validateFileSystem();
                await Promise.all(
                    result.filesMissingInMinio.map(async (file) => {
                        file.state = FileState.LOST;
                        await this.fileRepository.save(file);
                        logger.error(
                            'File missing in Minio: ' +
                                file.mission.project.name +
                                '/' +
                                file.mission.name +
                                '/' +
                                file.filename,
                        );
                    }),
                );
                const missingDBEntries = result.missingBagDBEntries.concat(
                    result.missingMCAPDBEntries,
                );
                await Promise.all(
                    missingDBEntries.map(async (file) => {
                        const parts = file.split('/');
                        const mission = await this.missionRepository.findOne({
                            where: {
                                project: { name: parts[0] },
                                name: parts[1],
                            },
                        });
                        if (!mission) {
                            logger.error(
                                'File missing in DB: ' +
                                    file +
                                    '. Could not be restored',
                            );
                        } else {
                            const filetype = parts[2].endsWith('.bag')
                                ? FileType.BAG
                                : FileType.MCAP;
                            const restoredFile = this.fileRepository.create({
                                filename: parts[2],
                                mission,
                                type: filetype,
                                state: FileState.FOUND,
                                creator: { uuid: systemUser.uuid },
                                date: new Date(),
                                size: 0,
                            });
                            const queue = this.queueRepository.create({
                                identifier: file,
                                display_name: parts[2],
                                mission,
                                state: QueueState.AWAITING_PROCESSING,
                                location: FileLocation.MINIO,
                                creator: { uuid: systemUser.uuid },
                            });
                            await this.fileRepository.save(restoredFile);
                            await this.queueRepository.save(queue);
                            await this.fileQueue.add('processMinioFile', {
                                queueUuid: queue.uuid,
                                recovering: true,
                            });
                        }
                    }),
                );
            });
        } catch (e) {
            if (e instanceof ResourceLockedError) {
                logger.error('Failed to acquire lock for file sync');
            }
        }
    }

    async canCancelUpload(userUUID: string, missionUUID: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (!mission) {
            return false;
        }

        const canAccessProject = await this.projectAccessView.exists({
            where: {
                projectUUID: mission.project.uuid,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
        if (canAccessProject) {
            return true;
        }
        return await this.missionAccessView.exists({
            where: {
                missionUUID,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }

    async validateFileSystem() {
        const allFiles = await this.fileRepository.find({
            relations: ['mission', 'mission.project'],
            where: { state: FileState.OK },
        });
        const filesMissingInMinio: FileEntity[] = [];
        await Promise.all(
            allFiles.map(async (file) => {
                const fileExists = await this.doesFileExist(
                    file.type === FileType.BAG
                        ? env.MINIO_BAG_BUCKET_NAME
                        : env.MINIO_MCAP_BUCKET_NAME,
                    `${file.mission.project.name}/${file.mission.name}/${file.filename}`,
                );
                if (!fileExists) {
                    filesMissingInMinio.push(file);
                }
            }),
        );
        const missingBagDBEntries = await this.checkBucket(
            env.MINIO_BAG_BUCKET_NAME,
        );
        const missingMCAPDBEntries = await this.checkBucket(
            env.MINIO_MCAP_BUCKET_NAME,
        );

        return {
            filesMissingInMinio,
            missingBagDBEntries,
            missingMCAPDBEntries,
        };
    }

    async doesFileExist(
        bucketName: string,
        objectName: string,
    ): Promise<boolean> {
        try {
            await internalMinio.statObject(bucketName, objectName);
            return true;
        } catch (err) {
            if (err.code === 'NotFound') {
                return false;
            }
            // Handle other potential errors (e.g., network issues)
            throw err;
        }
    }

    async checkBucket(bucketName: string) {
        const filesMissingInDB: string[] = [];

        const objects = internalMinio.listObjects(bucketName, '', true);
        const done = new Promise<void>((resolve, reject) => {
            const processingPromises: Promise<void>[] = [];

            objects.on('data', (obj) => {
                const processObject = async () => {
                    const nameSplit = obj.name.split('/');
                    if (nameSplit.length < 3) {
                        filesMissingInDB.push(obj.name);
                    }
                    const found = await this.fileRepository.exists({
                        where: {
                            filename: nameSplit[nameSplit.length - 1],
                            mission: {
                                project: {
                                    name: nameSplit[0],
                                },
                                name: nameSplit[1],
                            },
                        },
                    });
                    if (!found) {
                        console.log('File not found in DB:', obj.name);
                        filesMissingInDB.push(obj.name);
                    }
                };

                processingPromises.push(processObject());
            });

            objects.on('end', () => {
                Promise.all(processingPromises)
                    .then(() => resolve())
                    .catch((err) => reject(err));
            });

            objects.on('error', (err) => {
                reject(err);
            });
        });

        await done;
        return filesMissingInDB;
    }
}
