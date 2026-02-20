import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Repository } from 'typeorm';
import logger from '../logger';
import { RosBagMetadataService } from './handlers/rosbag-metadata.service';

@Processor('file-cleanup')
export class FileRepairProcessor {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepo: Repository<FileEntity>,
        private readonly storageService: StorageService,
        private readonly rosBagMetadataService: RosBagMetadataService,
    ) {}

    @Process('extract-topics-repair')
    async handleTopicExtraction(
        job: Job<{ fileUuid: string; filename: string }>,
    ): Promise<void> {
        const { fileUuid, filename } = job.data;

        logger.debug(
            `[Repair] Starting topic extraction (streaming) for ${filename} (${fileUuid})`,
        );

        try {
            const fileEntity = await this.fileRepo.findOne({
                where: { uuid: fileUuid },
                relations: ['mission'],
            });

            if (!fileEntity) {
                logger.warn(
                    `[Repair] File entity ${fileUuid} not found, skipping.`,
                );
                return;
            }

            // Get an internal presigned URL (valid for 60 minutes)
            const presignedUrl =
                await this.storageService.getInternalPresignedDownloadUrl(
                    env.S3_DATA_BUCKET_NAME,
                    fileUuid,
                    60 * 60,
                );

            // Stream directly from MinIO
            await this.rosBagMetadataService.extractFromUrl(
                presignedUrl,
                fileEntity,
            );

            logger.debug(
                `[Repair] Successfully extracted topics for ${filename} via streaming`,
            );
        } catch (error: unknown) {
            logger.error(
                `[Repair] Failed to extract topics for ${filename}: ${String(error)}`,
            );
        }
    }
}
