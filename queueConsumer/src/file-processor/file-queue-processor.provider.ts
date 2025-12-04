import IngestionJobEntity from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { FileLocation } from '@kleinkram/shared';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
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
    ) {}

    @Process({ name: 'processDriveFile', concurrency: 1 })
    async processDriveFile(job: Job<{ queueUuid: string }>): Promise<void> {
        logger.debug(`Processing Drive File Job: ${job.data.queueUuid}`);
        return this.runPipeline(job.data.queueUuid);
    }

    @Process({ name: 'processMinioFile', concurrency: 1 })
    async processMinioFile(job: Job<{ queueUuid: string }>): Promise<void> {
        logger.debug(`Processing Minio File Job: ${job.data.queueUuid}`);
        return this.runPipeline(job.data.queueUuid);
    }

    private async runPipeline(queueUuid: string): Promise<void> {
        const queueItem = await this.queueRepo.findOneOrFail({
            where: { uuid: queueUuid },
            relations: ['mission', 'creator', 'mission.project'],
        });

        const strategy =
            queueItem.location === FileLocation.DRIVE
                ? this.driveStrategy
                : this.minioStrategy;

        await this.fileIngestionService.processJob(queueItem, strategy);
    }
}
