import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import {
    AccessGroupRights,
    FileState,
    QueueState,
    UserRole,
} from '@kleinkram/shared';
import { Process, Processor } from '@nestjs/bull';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import Redlock from 'redlock';
import {
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import logger from '../logger';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock!: Redlock;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
    ) {}

    onModuleInit(): void {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Process({ concurrency: 10, name: 'cancelUpload' })
    async process(job: CancelUploadJob): Promise<void> {
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

                if (file.mission === undefined) {
                    logger.error(
                        `Mission of file ${file.uuid} is undefined, skipping`,
                    );
                    return;
                }

                const queue = await this.queueRepository.findOneOrFail({
                    where: {
                        displayName: file.filename,
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
    async fixFileHashes(): Promise<void> {
        await this.redlock
            .using([`lock:hash-repair`], 10_000, async () => {
                logger.debug('Fixing file hashes');

                const files = await this.fileRepository.find({
                    where: { hash: IsNull(), state: Not(FileState.LOST) },
                    relations: ['mission', 'mission.project'],
                });
                for (const file of files) {
                    const hash = crypto.createHash('md5');

                    if (file.mission === undefined) {
                        logger.error(
                            `Mission of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

                    if (file.mission.project === undefined) {
                        logger.error(
                            `Project of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

                    // Use DataStorageBucket to get stream (files are stored by UUID)
                    const datastream = await this.dataStorage.getFileStream(
                        file.uuid,
                    );
                    await new Promise((resolve, reject) => {
                        datastream.on('error', (error) => {
                            logger.error(error);
                            resolve(void 0);
                        });
                        datastream.on('data', (chunk: Buffer) => {
                            hash.update(chunk);
                        });
                        datastream.on('end', () => {
                            file.hash = hash.digest('base64');
                            this.fileRepository
                                .save(file)
                                .then(resolve)
                                .catch((error: unknown) => {
                                    reject(error as Error);
                                });
                        });
                    });
                }
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for hash repair");
            });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanupFailedUploads(): Promise<void> {
        await this.redlock
            .using([`lock:cleanup-failed-uploads`], 10_000, async () => {
                logger.debug('Cleaning up failed uploads');
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

                        if (file.mission === undefined) {
                            logger.error(
                                `Mission of file ${file.uuid} is undefined, skipping`,
                            );
                            return;
                        }

                        const queue = await this.queueRepository.findOne({
                            where: {
                                displayName: file.filename,
                                mission: { uuid: file.mission.uuid },
                            },
                        });
                        if (queue) {
                            queue.state = QueueState.ERROR;
                            await this.queueRepository.save(queue);
                        }
                    }),
                );

                // set pending queue entries to error
                const pendingQueues = await this.queueRepository.find({
                    where: {
                        state: QueueState.AWAITING_UPLOAD,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    pendingQueues.map(async (queue) => {
                        queue.state = QueueState.ERROR;
                        await this.queueRepository.save(queue);
                    }),
                );
            })
            .catch(() => {
                logger.debug(
                    "Couldn't acquire lock for cleanup failed uploads",
                );
            });
    }

    async canCancelUpload(
        userUUID: string,
        missionUUID: string,
    ): Promise<boolean> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });

        if (mission.project === undefined) {
            logger.error(
                `Project of mission ${mission.uuid} is undefined, skipping`,
            );
            return false;
        }

        const canAccessProject = await this.projectAccessView.exists({
            where: {
                projectUuid: mission.project.uuid,
                userUuid: userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
        if (canAccessProject) {
            return true;
        }
        return await this.missionAccessView.exists({
            where: {
                missionUuid: missionUUID,
                userUuid: userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }
}
