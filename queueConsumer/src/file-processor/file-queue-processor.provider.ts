import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { FileLocation, QueueState } from '@kleinkram/shared';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { Repository } from 'typeorm';
import logger from '../logger';
import { FileIngestionService } from './file-ingestion.service';
import { GoogleDriveStrategy } from './strategies/google-drive.strategy';
import { MinioStrategy } from './strategies/minio.strategy';

@Processor('file-queue')
@Injectable()
export class FileQueueProcessorProvider {
    constructor(
        @InjectRepository(IngestionJobEntity)
        private queueRepo: Repository<IngestionJobEntity>,
        private readonly fileIngestionService: FileIngestionService,
        private readonly driveStrategy: GoogleDriveStrategy,
        private readonly minioStrategy: MinioStrategy,
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

    @Process({ name: 'processMinioFile', concurrency: 1 })
    async processMinioFile(job: Job<{ queueUuid: string }>): Promise<void> {
        logger.debug(`Processing Minio File Job: ${job.data.queueUuid}`);
        const queueItem = await this.queueRepo.findOneOrFail({
            where: { uuid: job.data.queueUuid },
            relations: ['mission', 'creator', 'mission.project'],
        });
        return this.runPipeline(queueItem);
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
                : this.minioStrategy;

        await this.fileIngestionService.processJob(queueItem, strategy);
    }
}
