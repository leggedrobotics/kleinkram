import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';

import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState, QueueState } from '@kleinkram/shared';
import { Processor } from '@nestjs/bull';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import Redlock from 'redlock';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import logger from '../logger';

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock!: Redlock;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,

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
                                    reject(
                                        error instanceof Error
                                            ? error
                                            : new Error(String(error)),
                                    );
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

                // Clean up canceled uploads older than 24 hours
                const canceledUploads = await this.fileRepository.find({
                    where: {
                        state: FileState.CANCELED,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 24),
                        ),
                    },
                });
                if (canceledUploads.length > 0) {
                    logger.debug(
                        `Cleaning up ${String(canceledUploads.length)} canceled uploads`,
                    );
                    const canceledUuids = canceledUploads.map((f) => f.uuid);
                    await this.queueRepository
                        .softDelete({
                            identifier: In(canceledUuids),
                        })
                        .catch((error: unknown) => {
                            logger.error(
                                `Failed to soft-delete ingestion jobs for canceled uploads: ${String(error)}`,
                            );
                        });

                    await Promise.all(
                        canceledUploads.map(async (file) => {
                            try {
                                await this.dataStorage
                                    .deleteFile(file.uuid)
                                    .catch((error: unknown) => {
                                        logger.error(
                                            `Failed to delete S3 object for ${file.uuid}: ${String(error)}`,
                                        );
                                    });
                                await this.fileRepository.softDelete({
                                    uuid: file.uuid,
                                    state: FileState.CANCELED,
                                });
                            } catch (error: unknown) {
                                logger.error(
                                    `Failed to clean up canceled upload ${file.uuid}: ${String(error)}`,
                                );
                            }
                        }),
                    );
                }
            })
            .catch(() => {
                logger.debug(
                    "Couldn't acquire lock for cleanup failed uploads",
                );
            });
    }
}
