import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Repository } from 'typeorm';

import { FileVersionEntity } from '@kleinkram/backend-common/entities/file/file-version.entity';
import { saveActiveVersion } from '@kleinkram/backend-common/entities/file/file-version.helpers';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import {
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@kleinkram/shared';
import logger from '../logger';
import {
    FILE_HANDLER,
    FileHandler,
    FileProcessingContext,
} from './handlers/file-handler.interface';
import { createHashingStream } from './helper/hash-helper';
import { MagicNumberValidator } from './helper/magic-number.validator';
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
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
    ) {}

    async processJob(
        queueItem: IngestionJobEntity,
        strategy: FileSourceStrategy,
    ): Promise<void> {
        let primaryFile: FileEntity | undefined;
        await this.runWithWorkspace(
            async (workDirectory: string): Promise<void> => {
                try {
                    const fileData = await this.downloadAndHash(
                        queueItem,
                        strategy,
                        workDirectory,
                    );

                    primaryFile = await this.createAndSaveFileEntity(
                        queueItem,
                        fileData,
                    );

                    await this.ensureFileIsInS3(
                        queueItem,
                        primaryFile,
                        fileData.filePath,
                    );

                    const isValid = await MagicNumberValidator.validate(
                        fileData.filePath,
                        primaryFile.type,
                    );

                    if (!isValid) {
                        const cause = `Magic number validation failed for ${primaryFile.filename} (${primaryFile.type})`;
                        logger.warn(cause);
                        primaryFile.state = FileState.CORRUPTED;
                        primaryFile.state_cause = cause;
                        await saveActiveVersion(
                            this.fileRepo.manager,
                            primaryFile,
                        );
                        await this.updateQueueState(
                            queueItem,
                            QueueState.CORRUPTED,
                            cause,
                        );
                        return;
                    }

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
                } catch (error: unknown) {
                    const errorMessage = String(error);
                    logger.error(`Failed to ingest file: ${errorMessage}`);
                    if (primaryFile) {
                        if (primaryFile.state === FileState.OK) {
                            primaryFile.state = FileState.ERROR;
                        }
                        primaryFile.state_cause ??= errorMessage;
                        try {
                            await saveActiveVersion(
                                this.fileRepo.manager,
                                primaryFile,
                            );
                        } catch {
                            // ignore save failure during error handling
                        }
                    }
                    await this.updateQueueState(
                        queueItem,
                        QueueState.ERROR,
                        errorMessage,
                    );
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

        queueItem.displayName = source.filename;
        await this.queueRepo.save(queueItem);

        const downloadPath = path.join(workDirectory, source.filename);

        const taggingKey = source.storageUuid ?? queueItem.identifier;
        // Start Tagging in the Background
        const taggingPromise = this.dataStorage
            .addTags(taggingKey, {
                missionUuid: queueItem.mission?.uuid ?? '',
                projectUuid: queueItem.mission?.project?.uuid ?? '',
                filename: source.filename,
            })
            .then(() => logger.debug(`File Tags added for ${taggingKey}`))
            .catch((error: unknown) =>
                logger.warn(
                    `Failed to add tags during download: ${String(error)}`,
                ),
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
        let existingFile;

        // Drive Files do not have a UUID identifier, so we cannot verify existence by UUID.
        // For standard uploads, the identifier IS the UUID.
        if (queueItem.location !== FileLocation.DRIVE) {
            existingFile = await this.fileRepo.findOne({
                where: [
                    { uuid: queueItem.identifier },
                    { activeVersionUuid: queueItem.identifier },
                ],
                relations: { activeVersion: true },
            });
        }

        if (existingFile) {
            return existingFile;
        }

        const isBag = data.filename.endsWith('.bag');
        const isDb3 = data.filename.endsWith('.db3');
        const isMcap = data.filename.endsWith('.mcap');
        const isSvo2 = data.filename.endsWith('.svo2');
        const isTum = data.filename.endsWith('.tum');
        const isYaml =
            data.filename.endsWith('.yaml') || data.filename.endsWith('.yml');

        let type = FileType.MCAP;
        if (isBag) type = FileType.BAG;
        if (isDb3) type = FileType.DB3;
        if (isMcap) type = FileType.MCAP;
        if (isSvo2) type = FileType.SVO2;
        if (isTum) type = FileType.TUM;
        if (isYaml) type = FileType.YAML;

        // `create()` only copies mapped columns, and everything below the
        // filename now lives on the version, so the version is built by hand
        // and saved along with the file through the `activeVersion` cascade.
        const entity = this.fileRepo.create({
            mission: queueItem.mission,
            filename: data.filename,
            creator: queueItem.creator,
        } as FileEntity);

        entity.activeVersion = this.fileRepo.manager.create(FileVersionEntity, {
            versionNumber: 1,
            date: new Date(),
            size: data.size,
            type,
            state: FileState.UPLOADING,
            hash: data.hash,
            origin:
                queueItem.location === FileLocation.DRIVE
                    ? FileOrigin.GOOGLE_DRIVE
                    : FileOrigin.UPLOAD,
        });

        return await this.fileRepo.save(entity);
    }

    private async ensureFileIsInS3(
        queueItem: IngestionJobEntity,
        file: FileEntity,
        filePath: string,
    ): Promise<void> {
        if (queueItem.location === FileLocation.DRIVE) {
            await this.dataStorage.uploadFile(file.storageUuid, filePath);
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
        errorMessage?: string,
    ): Promise<void> {
        queueItem.state = state;
        if (state === QueueState.COMPLETED) {
            queueItem.processingDuration = 0; // You might want to calculate real duration here
        }
        if (errorMessage) {
            queueItem.errorMessage = errorMessage.slice(0, 1000); // Truncate to avoid DB errors
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
            } catch (cleanupError: unknown) {
                logger.warn(
                    `Failed to clean up temp dir ${workDirectory}: ${String(cleanupError)}`,
                );
            }
        }
    }
}
