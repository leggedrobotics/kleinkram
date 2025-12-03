import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Repository } from 'typeorm';

import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import env from '@common/environment';
import {
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import logger from 'src/logger';
import {
    FILE_HANDLER,
    FileHandler,
    FileProcessingContext,
} from './handlers/file-handler.interface';
import { createHashingStream } from './helper/hash-helper';
import { FileSourceStrategy } from './strategies/file-source.interface';

interface DownloadResult {
    filePath: string;
    filename: string;
    hash: string;
    size: number;
}

@Injectable()
export class FileIngestionService {
    constructor(
        @Inject(FILE_HANDLER) private readonly fileHandlers: FileHandler[],
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private queueRepo: Repository<IngestionJobEntity>,
        private readonly storageService: StorageService,
    ) {}

    async processJob(
        queueItem: IngestionJobEntity,
        strategy: FileSourceStrategy,
    ): Promise<void> {
        await this.runWithWorkspace(
            async (workDirectory: string): Promise<void> => {
                try {
                    const fileData = await this.downloadAndHash(
                        queueItem,
                        strategy,
                        workDirectory,
                    );

                    const primaryFile = await this.createAndSaveFileEntity(
                        queueItem,
                        fileData,
                    );

                    await this.ensureFileIsInMinio(
                        queueItem,
                        primaryFile,
                        fileData.filePath,
                    );

                    await this.executeFileHandlers(
                        queueItem,
                        primaryFile,
                        fileData,
                        workDirectory,
                    );

                    await this.updateQueueState(
                        queueItem,
                        QueueState.COMPLETED,
                    );
                } catch (error) {
                    logger.error(`Failed to ingest file: ${error}`);
                    await this.updateQueueState(queueItem, QueueState.ERROR);
                    throw error;
                }
            },
        );
    }

    private async downloadAndHash(
        queueItem: IngestionJobEntity,
        strategy: FileSourceStrategy,
        workDirectory: string,
    ): Promise<DownloadResult> {
        await this.updateQueueState(queueItem, QueueState.DOWNLOADING);

        const source = await strategy.fetch(queueItem.identifier);
        const downloadPath = path.join(workDirectory, source.filename);

        // Start Tagging in the Background
        const taggingPromise = this.storageService
            .addTags(env.MINIO_DATA_BUCKET_NAME, queueItem.identifier, {
                missionUuid: queueItem.mission?.uuid ?? '',
                projectUuid: queueItem.mission?.project?.uuid ?? '',
                filename: source.filename,
            })
            .then(() =>
                logger.debug(`File Tags added for ${queueItem.identifier}`),
            )
            .catch((error: unknown) =>
                logger.warn(`Failed to add tags during download: ${error}`),
            );

        const { stream: hashStream, getHash } = createHashingStream();

        // This ensures pipeline() starts reading from source.stream IMMEDIATELY,
        // preventing the connection from timing out while tags are being added.
        await Promise.all([
            pipeline(
                source.stream,
                hashStream,
                fs.createWriteStream(downloadPath),
            ),
            taggingPromise,
        ]);

        return {
            filePath: downloadPath,
            filename: source.filename,
            hash: getHash(),
            size: fs.statSync(downloadPath).size,
        };
    }

    private async createAndSaveFileEntity(
        queueItem: IngestionJobEntity,
        data: DownloadResult,
    ): Promise<FileEntity> {
        const existingFile = await this.fileRepo.findOne({
            where: { uuid: queueItem.identifier },
        });

        if (existingFile) {
            return existingFile;
        }

        const isBag = data.filename.endsWith('.bag');
        const isDb3 = data.filename.endsWith('.db3');

        let type = FileType.MCAP;
        if (isBag) type = FileType.BAG;
        if (isDb3) type = FileType.DB3;

        const entity = this.fileRepo.create({
            date: new Date(),
            mission: queueItem.mission,
            size: data.size,
            filename: data.filename,
            creator: queueItem.creator,
            type,
            state: FileState.UPLOADING,
            hash: data.hash,
            origin:
                queueItem.location === FileLocation.DRIVE
                    ? FileOrigin.GOOGLE_DRIVE
                    : FileOrigin.UPLOAD,
        } as FileEntity);

        return await this.fileRepo.save(entity);
    }

    private async ensureFileIsInMinio(
        queueItem: IngestionJobEntity,
        file: FileEntity,
        filePath: string,
    ): Promise<void> {
        if (queueItem.location === FileLocation.DRIVE) {
            await this.storageService.uploadFile(
                env.MINIO_DATA_BUCKET_NAME,
                file.uuid,
                filePath,
            );
        }
    }

    private async executeFileHandlers(
        queueItem: IngestionJobEntity,
        primaryFile: FileEntity,
        fileData: DownloadResult,
        workDirectory: string,
    ): Promise<void> {
        await this.updateQueueState(queueItem, QueueState.PROCESSING);

        const context: FileProcessingContext = {
            workDirectory: workDirectory,
            filePath: fileData.filePath,
            fileType: path.extname(fileData.filename),
            queueItem,
            primaryFile,
        };

        for (const fileHandler of this.fileHandlers) {
            if (fileHandler.canHandle(fileData.filename)) {
                logger.debug(
                    `Starting handler ${fileHandler.constructor.name} for ${fileData.filename}`,
                );
                await fileHandler.process(context);
            }
        }
    }

    private async updateQueueState(
        queueItem: IngestionJobEntity,
        state: QueueState,
    ): Promise<void> {
        queueItem.state = state;
        if (state === QueueState.COMPLETED) {
            queueItem.processingDuration = 0; // You might want to calculate real duration here
        }
        await this.queueRepo.save(queueItem);
    }

    private async runWithWorkspace(
        callback: (workDirectory: string) => Promise<void>,
    ): Promise<void> {
        const workDirectory = path.join('/tmp', `job-${randomUUID()}`);

        if (!fs.existsSync(workDirectory)) {
            fs.mkdirSync(workDirectory, { recursive: true });
        }

        try {
            await callback(workDirectory);
        } finally {
            try {
                if (fs.existsSync(workDirectory)) {
                    fs.rmSync(workDirectory, { recursive: true, force: true });
                }
            } catch (cleanupError) {
                logger.warn(
                    `Failed to clean up temp dir ${workDirectory}: ${cleanupError}`,
                );
            }
        }
    }
}
