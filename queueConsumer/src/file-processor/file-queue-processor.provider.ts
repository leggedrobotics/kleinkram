import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileLocation, FileState, QueueState } from '@kleinkram/shared';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { Repository } from 'typeorm';
import logger from '../logger';
import { FileIngestionService } from './file-ingestion.service';
import { GoogleDriveStrategy } from './strategies/google-drive.strategy';
import { S3Strategy } from './strategies/s3.strategy';

import { createHash } from 'node:crypto';

@Processor('file-queue')
@Injectable()
export class FileQueueProcessorProvider {
    constructor(
        @InjectRepository(IngestionJobEntity)
        private queueRepo: Repository<IngestionJobEntity>,
        @InjectRepository(FileEntity)
        private fileRepo: Repository<FileEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly fileIngestionService: FileIngestionService,
        private readonly driveStrategy: GoogleDriveStrategy,
        private readonly s3Strategy: S3Strategy,
        @InjectQueue('file-queue') private fileQueue: Queue,
    ) {}

    @Process({ name: 'processDriveFile', concurrency: 1 })
    async processDriveFile(job: Job<{ queueUuid: string }>): Promise<void> {
        logger.debug(`Processing Drive File Job: ${job.data.queueUuid}`);

        const queueItem = await this.queueRepo.findOneOrFail({
            where: { uuid: job.data.queueUuid },
            relations: ['mission', 'creator', 'mission.project'],
        });

        // Check if it is a folder (recursive ingestion)
        if (queueItem.location === FileLocation.DRIVE) {
            const metadata = await this.driveStrategy.getMetadata(
                queueItem.identifier,
            );

            if (metadata.mimeType === 'application/vnd.google-apps.folder') {
                logger.debug(
                    `Found Google Drive Folder: ${queueItem.displayName}. EXPANDING...`,
                );
                await this.expandDriveFolder(queueItem);
                return;
            }
        }

        return this.runPipeline(queueItem);
    }

    @Process({ name: 'processS3File', concurrency: 1 })
    async processS3File(job: Job<{ queueUuid: string }>): Promise<void> {
        logger.debug(`Processing S3 File Job: ${job.data.queueUuid}`);
        const queueItem = await this.queueRepo.findOneOrFail({
            where: { uuid: job.data.queueUuid },
            relations: ['mission', 'creator', 'mission.project'],
        });
        return this.runPipeline(queueItem);
    }

    @Process({ name: 'extractHashFromS3' })
    async extractHashFromS3(job: Job<{ fileUuid: string }>): Promise<void> {
        const { fileUuid } = job.data;
        logger.debug(`Extracting hash for file ${fileUuid}`);

        const file = await this.fileRepo.findOne({
            where: { uuid: fileUuid },
        });
        if (!file) {
            logger.error(`File ${fileUuid} not found for hash extraction`);
            return;
        }

        try {
            const stat = await this.dataStorage.getFileInfo(file.uuid);
            // ETag is often surrounded by quotes in S3, e.g. "5b3...c6"
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            let hash = stat?.etag?.replaceAll('"', '');

            // Valid MD5 is 32 hex chars. S3 multipart ETag has -N suffix.
            const ismd5 = /^[\da-f]{32}$/i.test(hash ?? '');

            if (hash && ismd5) {
                logger.debug(
                    `Found MD5 hash in metadata for ${fileUuid}: ${hash}`,
                );
                // Convert Hex MD5 to Base64 to match CLI/Frontend expectation
                hash = Buffer.from(hash, 'hex').toString('base64');
            } else {
                logger.debug(
                    `Calculating hash for ${fileUuid} (ETag: ${String(hash)})`,
                );
                const stream = await this.dataStorage.getFileStream(file.uuid);
                hash = await this.calculateHash(stream);
            }

            file.hash = hash;
            // Ensure state is OK if it was somehow different
            file.state = FileState.OK;
            await this.fileRepo.save(file);
            logger.debug(`Updated hash for ${fileUuid}`);
        } catch (error) {
            logger.error(
                `Failed to extract hash for ${fileUuid}: ${String(error)}`,
            );
            throw error;
        }
    }

    private calculateHash(stream: NodeJS.ReadableStream): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => {
                resolve(hash.digest('base64'));
            });
            stream.on('error', (error) => {
                reject(
                    error instanceof Error ? error : new Error(String(error)),
                );
            });
        });
    }

    private async expandDriveFolder(parentJob: IngestionJobEntity) {
        try {
            const files = await this.driveStrategy.listFiles(
                parentJob.identifier,
            );
            logger.debug(
                `Expanding folder ${parentJob.identifier}: Found ${String(files.length)} files`,
            );

            for (const file of files) {
                // If it's a folder, we recurse (by adding it to the queue)
                // If it's a file, we add it to the queue
                // We basically clone the parent job but change identifier/name
                const newJob = this.queueRepo.create({
                    identifier: file.id,
                    displayName: file.name,
                    state: QueueState.AWAITING_PROCESSING,
                    mission: parentJob.mission,
                    creator: parentJob.creator,
                    location: parentJob.location,
                });

                const savedJob = await this.queueRepo.save(newJob);
                await this.fileQueue.add('processDriveFile', {
                    queueUuid: savedJob.uuid,
                });
            }

            // Mark folder as completed
            parentJob.state = QueueState.COMPLETED;
            await this.queueRepo.save(parentJob);
        } catch (error) {
            logger.error(
                `Failed to expand folder ${parentJob.identifier}: ${String(error)}`,
            );
            parentJob.state = QueueState.ERROR;
            parentJob.errorMessage = String(error).slice(0, 1000);
            await this.queueRepo.save(parentJob);
        }
    }

    private async runPipeline(queueItem: IngestionJobEntity): Promise<void> {
        const strategy =
            queueItem.location === FileLocation.DRIVE
                ? this.driveStrategy
                : this.s3Strategy;

        await this.fileIngestionService.processJob(queueItem, strategy);
    }
}
