import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import { Repository } from 'typeorm';

import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import env from '@common/environment';
import {
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import logger from 'src/logger';

import FileEventEntity from '@common/entities/file/file-event.entity';
import { calculateFileHash } from '../helper/hash-helper';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';
import { RosBagConverter } from './rosbag-converter';
import { RosBagMetadataService } from './rosbag-metadata.service'; //

@Injectable()
export class RosBagHandler implements FileHandler {
    constructor(
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private jobRepo: Repository<IngestionJobEntity>,
        @InjectRepository(FileEventEntity)
        private fileEventRepo: Repository<FileEventEntity>,
        private readonly storageService: StorageService,
        private readonly mcapMetadataService: McapMetadataService,
        private readonly rosBagMetadataService: RosBagMetadataService,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.bag');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath, workDirectory, queueItem } = context;
        const job = queueItem as unknown as IngestionJobEntity;
        const autoConvert = job.mission?.project?.autoConvert !== false;

        logger.debug(
            `Starting ROS Bag pipeline for ${primaryFile.filename} (AutoConvert: ${autoConvert})`,
        );

        // Update state to indicate we are working
        job.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
        await this.jobRepo.save(job);

        if (autoConvert) {
            try {
                // --- Path A: Convert to MCAP, then extract from MCAP ---
                const mcapFilename = primaryFile.filename.replace(
                    '.bag',
                    '.mcap',
                );
                const mcapOutputPath = path.join(workDirectory, mcapFilename);

                await RosBagConverter.convert(filePath, mcapOutputPath);

                if (!fs.existsSync(mcapOutputPath)) {
                    throw new Error('Conversion output file missing');
                }

                await this.handleAutoConvert(
                    primaryFile,
                    job,
                    mcapOutputPath,
                    mcapFilename,
                );
            } catch (error) {
                logger.error(`RosBag Conversion failed: ${error}`);
                primaryFile.state = FileState.CONVERSION_ERROR;
                await this.fileRepo.save(primaryFile);
                throw error;
            }
        } else {
            try {
                // --- Path B: Extraction Only (Stream directly from Bag) ---
                await this.handleExtractionOnly(primaryFile, filePath);
            } catch (error) {
                logger.error(`RosBag Extraction failed: ${error}`);
                primaryFile.state = FileState.CORRUPTED;
                await this.fileRepo.save(primaryFile);
                throw error;
            }
        }
    }

    /**
     * Case 1: AutoConvert is DISABLED.
     * We extract topics directly from the original BAG file using streaming.
     */
    private async handleExtractionOnly(
        primaryFile: FileEntity,
        bagPath: string,
    ): Promise<void> {
        logger.debug(
            `Extracting topics directly from Bag file: ${primaryFile.filename}`,
        );

        // Use the new service to read directly from the .bag file
        await this.rosBagMetadataService.extractFromLocalFile(
            bagPath,
            primaryFile,
        );
    }

    private async handleAutoConvert(
        primaryFile: FileEntity,
        job: IngestionJobEntity,
        mcapPath: string,
        mcapFilename: string,
    ): Promise<void> {
        const mcapEntity = this.fileRepo.create({
            date: new Date(),
            mission: job.mission,
            size: 0,
            filename: mcapFilename,
            creator: job.creator,
            type: FileType.MCAP,
            state: FileState.CONVERTING,
            origin: FileOrigin.CONVERTED,
            parent: primaryFile,
        } as FileEntity);

        const savedMcapEntity = await this.fileRepo.save(mcapEntity);

        try {
            // Extract from the generated MCAP
            await this.mcapMetadataService.extractFromLocalFile(
                mcapPath,
                savedMcapEntity,
            );

            savedMcapEntity.hash = await calculateFileHash(mcapPath);
            await this.fileRepo.save(savedMcapEntity);

            job.state = QueueState.UPLOADING;
            await this.jobRepo.save(job);

            await this.storageService.uploadFile(
                env.MINIO_DATA_BUCKET_NAME,
                savedMcapEntity.uuid,
                mcapPath,
            );

            // Add Tags logic...
            await this.storageService
                .addTags(env.MINIO_DATA_BUCKET_NAME, savedMcapEntity.uuid, {
                    missionUuid: job.mission?.uuid ?? '',
                    filename: mcapFilename,
                })
                .catch((error: unknown) =>
                    logger.warn(`Tagging failed: ${error}`),
                );

            // Update Primary Bag File (inherit date from conversion result)
            primaryFile.date = savedMcapEntity.date ?? primaryFile.date;
            primaryFile.state = FileState.OK;
            await this.fileRepo.save(primaryFile);

            // Cleanup local converted file
            await fsPromises.unlink(mcapPath);

            // Save Events
            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: primaryFile,
                    ...(job.mission ? { mission: job.mission } : {}),
                    type: FileEventType.FILE_CONVERTED,
                    filenameSnapshot: primaryFile.filename,
                    details: {
                        generatedFileUuid: savedMcapEntity.uuid,
                        generatedFilename: savedMcapEntity.filename,
                    },
                }),
            );

            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: savedMcapEntity,
                    ...(job.mission ? { mission: job.mission } : {}),
                    type: FileEventType.FILE_CONVERTED_FROM,
                    filenameSnapshot: savedMcapEntity.filename,
                    details: {
                        sourceFileUuid: primaryFile.uuid,
                        sourceFilename: primaryFile.filename,
                    },
                }),
            );
        } catch (error: unknown) {
            savedMcapEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(savedMcapEntity);

            // Ensure cleanup on failure
            if (fs.existsSync(mcapPath)) {
                await fsPromises.unlink(mcapPath).catch(() => ({}));
            }

            throw error;
        }
    }
}
