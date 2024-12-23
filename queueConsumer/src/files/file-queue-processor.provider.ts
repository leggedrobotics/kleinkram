import {
    InjectQueue,
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
    Process,
    Processor,
} from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { convertToMcap, mcapMetaInfo } from './helper/converter';
import {
    downloadDriveFile,
    getMetadata,
    listFiles,
} from './helper/drive-helper';
import { downloadMinioFile, uploadLocalFile } from './helper/minio-helper';
import logger from '../logger';
import { traceWrapper, tracing } from '../tracing';
import QueueEntity from '@common/entities/queue/queue.entity';
import FileEntity from '@common/entities/file/file.entity';
import Topic from '@common/entities/topic/topic.entity';
import env from '@common/environment';
import {
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { drive_v3 } from 'googleapis';
import fs from 'node:fs';
import { calculateFileHash } from './helper/hash-helper';
import { addTagsToMinioObject } from '@common/minio-helper';

// eslint-disable-next-line @typescript-eslint/no-require-imports,unicorn/prefer-module
const fsPromises = require('node:fs').promises;

type FileProcessorJob = Job<{
    queueUuid: string;
    tmp_files: string[];
    md5?: string;
    recovering?: boolean;
}>;

@Processor('file-queue')
@Injectable()
export class FileQueueProcessorProvider implements OnModuleInit {
    constructor(
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Topic) private topicRepository: Repository<Topic>,
    ) {
        logger.debug('FileProcessor created');
    }

    async onModuleInit() {
        logger.debug('Connecting to Redis...');
        try {
            await this.fileQueue.isReady();
            logger.debug('Connected to Redis successfully!');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
        }
    }

    private async getQueue(job: FileProcessorJob) {
        return await this.queueRepository.findOneOrFail({
            where: {
                uuid: job.data.queueUuid,
            },
            relations: ['mission', 'creator', 'mission.project'],
        });
    }

    private async deleteTmpFiles(job: FileProcessorJob) {
        try {
            const temporaryFilesDeduplicated = job.data.tmp_files.filter(
                (value, index, self) => self.indexOf(value) === index,
            );

            await Promise.all(
                temporaryFilesDeduplicated.map((temporaryFile) => {
                    logger.debug(`Deleting tmp file: ${temporaryFile}`);
                    if (fs.existsSync(temporaryFile))
                        fsPromises.unlink(temporaryFile);
                }),
            );
        } catch {
            logger.debug(`Error deleting tmp files`);
        }
    }

    @OnQueueActive()
    onActive(job: FileProcessorJob) {
        logger.debug(
            `Processing job ${job.id.toString()} of type ${job.name}.`,
        );
        job.data.tmp_files = []; // initialize tmp_files
    }

    @OnQueueCompleted()
    @tracing('onCompleted')
    async onCompleted(job: FileProcessorJob) {
        logger.debug(
            `Job ${job.id.toString()} of type ${job.name} has been completed.`,
        );

        // mark queue as done
        const queue = await this.getQueue(job);
        queue.state = Math.max(queue.state, QueueState.COMPLETED);
        queue.processingDuration =
            (job.finishedOn ?? 0) - (job.processedOn ?? 0);
        await this.queueRepository.save(queue);

        await this.deleteTmpFiles(job);
    }

    @OnQueueFailed()
    @tracing('onFailed')
    async onFailed(job: FileProcessorJob, error: Error) {
        logger.error(
            `Job ${job.id.toString()} of type ${job.name} has failed with error:\n  » ${error.message}`,
        );
        logger.error(error.stack);

        // mark queue as error
        const queue = await this.getQueue(job);
        if (queue.state !== QueueState.CORRUPTED)
            queue.state = QueueState.ERROR;
        queue.processingDuration =
            (job.finishedOn ?? 0) - (job.processedOn ?? 0);
        await this.queueRepository.save(queue);

        await this.deleteTmpFiles(job);
    }

    @Process({ concurrency: 1, name: 'processMinioFile' })
    @tracing('processMinioFile')
    async handleMinioFileProcessing(job: FileProcessorJob) {
        logger.debug(
            `Job ${job.id.toString()} started, uuid is ${job.data.queueUuid}`,
        );
        const _queue = await this.startProcessing(job.data.queueUuid);
        const md5 = job.data.md5;
        const sourceIsBag = _queue.display_name.endsWith('.bag');

        const uuid = crypto.randomUUID();
        const temporaryFileName = `/tmp/${uuid}.${sourceIsBag ? 'bag' : 'mcap'}`;
        job.data.tmp_files.push(temporaryFileName); // saved for cleanup

        _queue.state = QueueState.DOWNLOADING;
        const queue = await this.queueRepository.save(_queue);

        if (queue.mission === undefined)
            throw new Error('Mission is undefined');

        if (queue.mission.project === undefined)
            throw new Error('Project is undefined');

        // set tag inside minio
        await addTagsToMinioObject(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            queue.identifier,
            {
                mission_uuid: queue.mission.uuid,

                project_uuid: queue.mission.project.uuid,
                filename: queue.display_name,
            },
        );

        const filehash = await traceWrapper(async () => {
            return await downloadMinioFile(
                sourceIsBag
                    ? env.MINIO_BAG_BUCKET_NAME
                    : env.MINIO_MCAP_BUCKET_NAME,
                queue.identifier,
                temporaryFileName,
            );
        }, 'downloadMinioFile')();
        let bagSize;
        let mcapSize;
        if (sourceIsBag) {
            bagSize = fs.statSync(temporaryFileName).size;
        } else {
            mcapSize = fs.statSync(temporaryFileName).size;
        }

        let bagHash = '';
        let mcapHash = '';
        if (sourceIsBag) {
            bagHash = filehash;
        } else {
            mcapHash = filehash;
        }

        queue.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
        const __queue = await this.queueRepository.save(queue);

        logger.debug(
            `Job ${job.id.toString()} downloaded file: ${__queue.display_name}`,
        );
        const originalFileName = __queue.display_name.split('/').pop();

        let bagFileEntity: FileEntity | undefined;
        let mcapFileEntity: FileEntity | undefined;

        const mcapTemporaryFileName = temporaryFileName.replace(
            '.bag',
            '.mcap',
        );

        if (__queue.mission === undefined)
            throw new Error('Mission is undefined');

        if (originalFileName === undefined || originalFileName === '')
            throw new Error('Original filename is undefined');

        if (__queue.creator === undefined)
            throw new Error('Creator is undefined');

        const existingFileEntity = await this.fileRepository.findOneOrFail({
            where: {
                filename: originalFileName,
                mission: { uuid: __queue.mission.uuid },
            },
        });
        if (md5 && md5 !== filehash) {
            existingFileEntity.state = FileState.CORRUPTED;
            await this.fileRepository.save(existingFileEntity);
            throw new Error(
                `File ${originalFileName ?? 'N/A'} is corrupted: MD5 mismatch. Expected ${md5}, got ${filehash}`,
            );
        }
        let mcapExists = false;
        const mcapFilename = originalFileName.replace('.bag', '.mcap');

        // convert to bag and upload to minio
        if (sourceIsBag) {
            const _bagFileEntity =
                await this.fileRepository.save(existingFileEntity);
            bagFileEntity = _bagFileEntity;

            logger.debug(`Convert file ${__queue.identifier} from bag to mcap`);
            mcapExists = await this.fileRepository.exists({
                where: {
                    mission: { uuid: __queue.mission.uuid },
                    filename: mcapFilename,
                },
            });
            if (!mcapExists) {
                const tentativeMCAP = this.fileRepository.create({
                    date: new Date(),
                    mission: __queue.mission,
                    size: 0,
                    filename: mcapFilename,
                    creator: __queue.creator,
                    type: FileType.MCAP,
                    state: FileState.UPLOADING,
                    origin: FileOrigin.CONVERTED,
                    relatedFile: _bagFileEntity,
                });
                const _mcapFileEntity =
                    await this.fileRepository.save(tentativeMCAP);
                _bagFileEntity.relatedFile = _mcapFileEntity;
                await this.fileRepository.save(_bagFileEntity);

                // ------------- Convert to MCAP -------------
                const temporaryFileNameMcap = await convertToMcap(
                    temporaryFileName,
                ).catch(async (error: unknown) => {
                    logger.error(`Error converting file, possibly corrupted!`);
                    __queue.state = QueueState.CORRUPTED;
                    await this.queueRepository.save(__queue);
                    _bagFileEntity.state = FileState.CONVERSION_ERROR;
                    await this.fileRepository.save(_bagFileEntity);
                    await this.fileRepository.remove(_mcapFileEntity);
                    throw error;
                });
                mcapHash = await calculateFileHash(temporaryFileNameMcap);

                // ------------- Upload to Minio -------------
                __queue.state = QueueState.UPLOADING;
                await this.queueRepository.save(__queue);
                await uploadLocalFile(
                    env.MINIO_MCAP_BUCKET_NAME,
                    _mcapFileEntity.uuid,
                    _mcapFileEntity.filename,
                    temporaryFileNameMcap,
                ).catch(async (error: unknown) => {
                    logger.error(`Error converting file, possibly corrupted!`);
                    __queue.state = QueueState.ERROR;
                    await this.queueRepository.save(__queue);
                    _mcapFileEntity.state = FileState.ERROR;
                    await this.fileRepository.save(_mcapFileEntity);
                    throw error;
                });

                // set tag inside minio
                await addTagsToMinioObject(
                    env.MINIO_MCAP_BUCKET_NAME,
                    _mcapFileEntity.uuid,
                    {
                        mission_uuid: __queue.mission.uuid,
                        // @ts-ignore
                        project_uuid: __queue.mission.project.uuid,
                        filename: _mcapFileEntity.filename,
                    },
                );

                job.data.tmp_files.push(mcapTemporaryFileName); // saved for cleanup

                mcapSize = fs.statSync(mcapTemporaryFileName).size;
                mcapFileEntity = _mcapFileEntity;
                mcapFileEntity.hash = mcapHash;
            }
        } else {
            mcapFileEntity = existingFileEntity;
        }

        ////////////////////////////////////////////////////////////////
        // Extract Topics from MCAP file
        ////////////////////////////////////////////////////////////////
        let date: Date;
        if (mcapExists) {
            const existingMCAP = await this.fileRepository.findOneOrFail({
                where: {
                    mission: { uuid: queue.mission.uuid },
                    filename: mcapFilename,
                },
            });
            date = existingMCAP.date;
        } else if (mcapFileEntity === undefined) {
            throw new Error('MCAP file not found');
        } else {
            date = await this.extractTopics(
                job,
                queue,
                mcapFileEntity,
                mcapTemporaryFileName,
            );
        }

        ////////////////////////////////////////////////////////////////
        // Update recording date
        ////////////////////////////////////////////////////////////////
        if (sourceIsBag && bagFileEntity !== undefined) {
            bagFileEntity.hash = bagHash;
            bagFileEntity.size = bagSize;
            bagFileEntity.date = date;
            bagFileEntity.state = job.data.recovering
                ? FileState.FOUND
                : FileState.OK;
            await this.fileRepository.save(bagFileEntity);
        }

        if (!mcapExists && mcapFileEntity !== undefined) {
            mcapFileEntity.size = mcapSize;
            mcapFileEntity.hash = mcapHash;
            mcapFileEntity.date = date;
            mcapFileEntity.state = job.data.recovering
                ? FileState.FOUND
                : FileState.OK;
            await this.fileRepository.save(mcapFileEntity);
        }
        return true; // return true to indicate that the job is done
    }

    @Process({ name: 'processDriveFile', concurrency: 1 })
    @tracing('processDriveFile')
    async handleDriveFileProcessing(job: FileProcessorJob) {
        ////////////////////////////////////////////////////////////////////
        // Extract Metadata from Google Drive
        ////////////////////////////////////////////////////////////////////

        logger.debug(
            `Job ${job.id.toString()} started, uuid is ${job.data.queueUuid}`,
        );
        const queueEntity = await this.startProcessing(job.data.queueUuid);

        if (queueEntity.mission === undefined)
            throw new Error('Mission is undefined');

        const driveMetadata = await getMetadata(queueEntity.identifier);
        const originalFileName = driveMetadata.name;
        if (!originalFileName)
            throw new Error(
                'File has no filename. File not found on Google Drive?',
            );
        logger.debug(
            `Metadata for file ${queueEntity.identifier} is:\n  » ${originalFileName}`,
        );

        ////////////////////////////////////////////////////////////////////
        // Download file from Google Drive
        ////////////////////////////////////////////////////////////////////

        // recursively process folders
        if (driveMetadata.mimeType === 'application/vnd.google-apps.folder') {
            logger.debug(
                `Job {${job.id.toString()}} is a folder: ${originalFileName}, processing...`,
            );

            // save the display name
            queueEntity.display_name = `Google Drive Folder: '${originalFileName}'`;
            await this.queueRepository.save(queueEntity);

            await this.processDriveFolder(job, queueEntity);
            return;
        }
        // it's a file, process it
        logger.debug(
            `Job {${job.id.toString()}} is a file: ${originalFileName}, processing...`,
        );

        // save the display name
        queueEntity.display_name = `Google Drive File: '${originalFileName}'`;
        await this.queueRepository.save(queueEntity);

        const filenameWithoutExtension = originalFileName
            .split('.')
            .slice(0, -1)
            .join('.');

        const exists = await this.fileRepository.exists({
            where: {
                filename: Like(`${filenameWithoutExtension}.%`),
                mission: { uuid: queueEntity.mission.uuid },
            },
        });

        if (exists) {
            queueEntity.state = QueueState.FILE_ALREADY_EXISTS;
            await this.queueRepository.save(queueEntity);
            logger.error(
                `Job {${job.id.toString()}} file ${originalFileName} already exists`,
            );
            return false;
        }

        // reject files that are not .bag or .mcap
        if (
            !originalFileName.endsWith('.bag') &&
            !originalFileName.endsWith('.mcap')
        ) {
            queueEntity.state = QueueState.UNSUPPORTED_FILE_TYPE;
            await this.queueRepository.save(queueEntity);
            logger.error(
                `Job {${job.id.toString()}} file ${originalFileName} is not a .bag or .mcap file`,
            );
            return false;
        }

        const fileType = originalFileName.endsWith('.bag') ? 'bag' : 'mcap';
        const temporaryFileName = `/tmp/${queueEntity.identifier}.${fileType}`;
        job.data.tmp_files.push(temporaryFileName); // saved for cleanup
        queueEntity.state = QueueState.DOWNLOADING;
        await this.queueRepository.save(queueEntity);

        const filehash = await traceWrapper(async () => {
            return await downloadDriveFile(
                queueEntity.identifier,
                temporaryFileName,
            );
        }, 'downloadDriveFile')();

        queueEntity.state = QueueState.PROCESSING;
        await this.queueRepository.save(queueEntity);

        logger.debug(
            `Job {${job.id.toString()}} downloaded file: ${originalFileName}`,
        );

        ////////////////////////////////////////////////////////////////
        // Process the tmp file
        ////////////////////////////////////////////////////////////////

        await this.processTmpFile(
            job,
            queueEntity,
            temporaryFileName,
            originalFileName,
            filehash,
        );
        return true; // return true to indicate that the job is done
    }

    @tracing('processTmpFile')
    private async processTmpFile(
        job: FileProcessorJob,
        queueEntity: QueueEntity,
        temporaryFileName: string,
        originalFileName: string,
        filehash: string,
    ) {
        // validate that the tmp file exists
        if (!fs.existsSync(temporaryFileName))
            throw new Error(`File ${temporaryFileName} does not exist`);
        const sourceIsBag = originalFileName.endsWith('.bag');
        const fileType = sourceIsBag ? 'bag' : 'mcap';

        // validate that the tmp file is of the correct type
        if (!temporaryFileName.endsWith(`.${fileType}`))
            throw new Error(
                `File ${temporaryFileName} is not a ${fileType} file`,
            );

        ////////////////////////////////////////////////////////////////
        // Upload file to Minio (and convert to mcap if necessary)
        ////////////////////////////////////////////////////////////////

        if (queueEntity.mission === undefined)
            throw new Error('Mission is undefined');

        if (queueEntity.creator === undefined)
            throw new Error('Creator is undefined');

        let bagFileEntity: FileEntity | undefined;
        let mcapFileEntity: FileEntity | undefined;
        const newFileEntity = this.fileRepository.create({
            date: new Date(),
            mission: queueEntity.mission,
            size: fs.statSync(temporaryFileName).size,
            filename: originalFileName,
            creator: queueEntity.creator,
            type: sourceIsBag ? FileType.BAG : FileType.MCAP,
            state: FileState.UPLOADING,
            hash: filehash,
            origin: FileOrigin.GOOGLE_DRIVE,
        });
        const savedFileEntity = await this.fileRepository.save(newFileEntity);
        if (sourceIsBag) {
            bagFileEntity = savedFileEntity;
        } else {
            mcapFileEntity = savedFileEntity;
        }

        logger.debug(
            `Job {${job.id.toString()}} uploaded file: ${originalFileName}`,
        );

        // convert to bag to mcap and upload to minio
        if (sourceIsBag) {
            if (bagFileEntity === undefined)
                throw new Error('Bag file entity is undefined');

            logger.debug(`Convert file ${originalFileName} from bag to mcap`);
            const newMCAP = this.fileRepository.create({
                date: new Date(),
                mission: queueEntity.mission,
                size: 0,
                filename: originalFileName.replace('.bag', '.mcap'),
                creator: queueEntity.creator,
                type: FileType.MCAP,
                state: FileState.UPLOADING,
                origin: FileOrigin.CONVERTED,
                relatedFile: bagFileEntity,
            });
            mcapFileEntity = await this.fileRepository.save(newMCAP);
            bagFileEntity.relatedFile = mcapFileEntity;
            await this.fileRepository.save(bagFileEntity);

            // ------------- Convert to MCAP -------------

            queueEntity.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
            await this.queueRepository.save(queueEntity);
            const temporaryFileNameMcap = await convertToMcap(
                temporaryFileName,
            ).catch(async (error: unknown) => {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    `Error converting file ${queueEntity.identifier} to mcap: ${errorMessage}`,
                );
                queueEntity.state = QueueState.CORRUPTED;
                await this.queueRepository.save(queueEntity);
                bagFileEntity.state = FileState.CONVERSION_ERROR;
                await this.fileRepository.save(bagFileEntity);

                if (mcapFileEntity !== undefined)
                    await this.fileRepository.remove(mcapFileEntity);
                throw error;
            });

            const mcapHash = await calculateFileHash(temporaryFileNameMcap);

            // ------------- Upload to Minio -------------
            queueEntity.state = QueueState.UPLOADING;
            await this.queueRepository.save(queueEntity);

            await uploadLocalFile(
                env.MINIO_MCAP_BUCKET_NAME,
                mcapFileEntity.uuid,
                mcapFileEntity.filename,
                temporaryFileNameMcap,
            ).catch(async (error: unknown) => {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    `Error converting file, possibly corrupted: ${errorMessage}`,
                );
                queueEntity.state = QueueState.ERROR;
                await this.queueRepository.save(queueEntity);

                if (mcapFileEntity !== undefined) {
                    mcapFileEntity.state = FileState.ERROR;
                    await this.fileRepository.save(mcapFileEntity);
                }
                throw error;
            });

            if (queueEntity.mission.project === undefined)
                throw new Error('Project is undefined');

            // set tag inside minio
            await addTagsToMinioObject(
                env.MINIO_MCAP_BUCKET_NAME,
                mcapFileEntity.uuid,
                {
                    mission_uuid: queueEntity.mission.uuid,
                    project_uuid: queueEntity.mission.project.uuid,
                    filename: mcapFileEntity.filename,
                },
            );

            logger.debug(`File ${originalFileName} converted successfully`);
            mcapFileEntity.size = fs.statSync(temporaryFileNameMcap).size;
            mcapFileEntity.state = FileState.OK;
            mcapFileEntity.hash = mcapHash;
            mcapFileEntity = await this.fileRepository.save(mcapFileEntity);
        }
        queueEntity.state = QueueState.UPLOADING;
        await this.queueRepository.save(queueEntity);

        logger.debug(`Uploading file: ${originalFileName} to Minio`);
        await uploadLocalFile(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            savedFileEntity.uuid,
            savedFileEntity.filename,
            temporaryFileName,
        );

        if (queueEntity.mission.project === undefined)
            throw new Error('Project is undefined');

        // set tag inside minio
        await addTagsToMinioObject(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            savedFileEntity.uuid,
            {
                missionUuid: queueEntity.mission.uuid,
                projectUuid: queueEntity.mission.project.uuid,
                filename: savedFileEntity.filename,
            },
        );

        const mcapTemporaryFileName = temporaryFileName.replace(
            '.bag',
            '.mcap',
        );
        job.data.tmp_files.push(mcapTemporaryFileName); // saved for cleanup

        ////////////////////////////////////////////////////////////////
        // Extract Topics from MCAP file
        ////////////////////////////////////////////////////////////////

        if (mcapFileEntity === undefined)
            throw new Error('MCAP file entity is undefined');

        const date = await this.extractTopics(
            job,
            queueEntity,
            mcapFileEntity,
            mcapTemporaryFileName,
        );

        ////////////////////////////////////////////////////////////////
        // Update recording date
        ////////////////////////////////////////////////////////////////

        if (bagFileEntity === undefined)
            throw new Error('Bag file entity is undefined');

        if (sourceIsBag) {
            bagFileEntity.date = date;
            bagFileEntity.state = FileState.OK;
            await this.fileRepository.save(bagFileEntity);
        }
        mcapFileEntity.state = FileState.OK;
        mcapFileEntity.date = date;
        await this.fileRepository.save(mcapFileEntity);
    }

    @tracing('extractTopics')
    private async extractTopics(
        job: FileProcessorJob,
        queueEntity: QueueEntity,
        savedFile: FileEntity,
        temporaryFileName: string,
    ) {
        if (!temporaryFileName.endsWith('.mcap'))
            throw new Error(
                `File ${temporaryFileName} is not an mcap file, cannot extract topics`,
            );

        if (!fs.existsSync(temporaryFileName))
            throw new Error(`File ${temporaryFileName} does not exist`);

        if (savedFile.type !== FileType.MCAP)
            throw new Error(
                `File ${savedFile.filename} is not an mcap file, cannot extract topics`,
            );

        const {
            topics,
            date,
        }: {
            topics: Partial<Topic>[];
            date: Date;
            size: number;
        } = await mcapMetaInfo(temporaryFileName).catch(
            async (error: unknown) => {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    `Error extracting topics from file ${temporaryFileName}: ${errorMessage}`,
                );

                queueEntity.state = QueueState.CORRUPTED;
                await this.queueRepository.save(queueEntity);
                savedFile.state = FileState.CORRUPTED;
                await this.fileRepository.save(savedFile);
                throw error;
            },
        );
        logger.debug(
            `Job {${job.id.toString()}} saved file: ${savedFile.filename}`,
        );

        const foundTopics = topics.map(async (topic) => {
            const newTopic = this.topicRepository.create({
                ...topic,
                file: savedFile,
            });

            await this.topicRepository.save(newTopic);

            return this.topicRepository.findOne({
                where: { uuid: newTopic.uuid },
                relations: ['file'],
            });
        });

        const createdTopics = await Promise.all(foundTopics);
        logger.debug(
            `Job {${job.id.toString()}} created topics: ${createdTopics.map((topic) => topic?.name).toString()}`,
        );
        return date;
    }

    @tracing('processDriveFolder')
    private async processDriveFolder(
        job: FileProcessorJob,
        queue: QueueEntity,
    ): Promise<void> {
        logger.debug(`Job {${job.id.toString()}} is a folder, processing...`);
        const files: drive_v3.Schema$File[] =
            (await listFiles(queue.identifier)) ?? [];
        logger.debug(
            `Job {${job.id.toString()}} found files: ${files.map((file) => file.name).toString()}`,
        );

        await Promise.all(
            files.map(async (file): Promise<void> => {
                if (queue.mission === undefined)
                    throw new Error('Mission is undefined');
                if (queue.creator === undefined)
                    throw new Error('Creator is undefined');

                // create new queue entity
                if (
                    file.name?.endsWith('.bag') ||
                    file.name?.endsWith('.mcap') ||
                    file.mimeType === 'application/vnd.google-apps.folder'
                ) {
                    if (file.id === undefined)
                        throw new Error('File ID is undefined');

                    const newQueue = this.queueRepository.create({
                        display_name: `Google Drive File: '${file.name ?? 'N/A'}'`,
                        identifier: file.id ?? 'N/A',
                        state: QueueState.AWAITING_PROCESSING,
                        location: FileLocation.DRIVE,
                        mission: queue.mission,
                        creator: queue.creator,
                    });

                    await this.queueRepository.save(newQueue);

                    await this.fileQueue.add('processDriveFile', {
                        queueUuid: newQueue.uuid,
                    });
                }
            }),
        );
        queue.state = QueueState.COMPLETED;
        await this.queueRepository.save(queue);
    }

    private async startProcessing(queueUuid: string): Promise<QueueEntity> {
        const queue = await this.queueRepository.findOneOrFail({
            where: {
                uuid: queueUuid,
            },
            relations: ['mission', 'creator', 'mission.project'],
        });
        queue.state = QueueState.PROCESSING;
        await this.queueRepository.save(queue);
        return queue;
    }
}
