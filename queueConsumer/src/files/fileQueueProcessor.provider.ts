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
} from './helper/driveHelper';
import { downloadMinioFile, uploadLocalFile } from './helper/minioHelper';
import logger from '../logger';
import { traceWrapper, tracing } from '../tracing';
import QueueEntity from '@common/entities/queue/queue.entity';
import FileEntity from '@common/entities/file/file.entity';
import Topic from '@common/entities/topic/topic.entity';
import env from '@common/env';
import {
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/enum';
import { drive_v3 } from 'googleapis';
import fs from 'node:fs';
import { calculateFileHash } from './helper/hashHelper';
import {
    addTagsToMinioObject,
    getBucketFromFileType,
} from '@common/minio_helper';

const fs_promises = require('fs').promises;

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
            const tmp_files_deduplicated = job.data.tmp_files.filter(
                (value, index, self) => self.indexOf(value) === index,
            );

            await Promise.all(
                tmp_files_deduplicated.map((tmp_file) => {
                    logger.debug(`Deleting tmp file: ${tmp_file}`);
                    if (fs.existsSync(tmp_file)) fs_promises.unlink(tmp_file);
                }),
            );
        } catch (error) {
            logger.debug(`Error deleting tmp files`);
        }
    }

    @OnQueueActive()
    onActive(job: FileProcessorJob) {
        logger.debug(`Processing job ${job.id} of type ${job.name}.`);
        job.data.tmp_files = []; // initialize tmp_files
    }

    @OnQueueCompleted()
    @tracing('onCompleted')
    async onCompleted(job: FileProcessorJob) {
        logger.debug(`Job ${job.id} of type ${job.name} has been completed.`);

        // mark queue as done
        const queue = await this.getQueue(job);
        queue.state =
            queue.state < QueueState.COMPLETED
                ? QueueState.COMPLETED
                : queue.state;
        queue.processingDuration = job.finishedOn - job.processedOn;
        await this.queueRepository.save(queue);

        await this.deleteTmpFiles(job);
    }

    @OnQueueFailed()
    @tracing('onFailed')
    async onFailed(job: FileProcessorJob, error: Error) {
        logger.error(
            `Job ${job.id} of type ${job.name} has failed with error:\n  » ${error.message}`,
        );
        logger.error(error.stack);

        // mark queue as error
        const queue = await this.getQueue(job);
        if (queue.state != QueueState.CORRUPTED) queue.state = QueueState.ERROR;
        queue.processingDuration = job.finishedOn - job.processedOn;
        await this.queueRepository.save(queue);

        await this.deleteTmpFiles(job);
    }

    @Process({ concurrency: 1, name: 'processMinioFile' })
    @tracing('processMinioFile')
    async handleMinioFileProcessing(job: FileProcessorJob) {
        logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
        let queue = await this.startProcessing(job.data.queueUuid);
        const md5 = job.data.md5;
        const sourceIsBag = queue.display_name.endsWith('.bag');

        const uuid = crypto.randomUUID();
        const tmp_file_name = `/tmp/${uuid}.${sourceIsBag ? 'bag' : 'mcap'}`;
        job.data.tmp_files.push(tmp_file_name); // saved for cleanup

        queue.state = QueueState.DOWNLOADING;
        queue = await this.queueRepository.save(queue);

        // set tag inside minio
        await addTagsToMinioObject(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            queue.identifier,
            {
                missionUuid: queue.mission.uuid,
                projectUuid: queue.mission.project.uuid,
            },
        );

        const filehash = await traceWrapper(async () => {
            return await downloadMinioFile(
                sourceIsBag
                    ? env.MINIO_BAG_BUCKET_NAME
                    : env.MINIO_MCAP_BUCKET_NAME,
                queue.identifier,
                tmp_file_name,
            );
        }, 'downloadMinioFile')();
        const size = fs.statSync(tmp_file_name).size;

        let bagHash = '';
        let mcapHash = '';
        if (sourceIsBag) {
            bagHash = filehash;
        } else {
            mcapHash = filehash;
        }

        queue.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
        queue = await this.queueRepository.save(queue);

        logger.debug(`Job ${job.id} downloaded file: ${queue.display_name}`);
        const originalFileName = queue.display_name.split('/').pop();

        let bagFileEntity: FileEntity | undefined;
        let mcapFileEntity: FileEntity | undefined;

        const mcap_temp_file_name = tmp_file_name.replace('.bag', '.mcap');

        let existingFileEntity = await this.fileRepository.findOne({
            where: {
                filename: originalFileName,
                mission: { uuid: queue.mission.uuid },
            },
        });
        if (md5 && md5 !== filehash) {
            existingFileEntity.state = FileState.CORRUPTED;
            await this.fileRepository.save(existingFileEntity);
            throw new Error(
                `File ${originalFileName} is corrupted: MD5 mismatch. Expected ${md5}, got ${filehash}`,
            );
        }
        let mcapExists = false;
        const mcapFilename = originalFileName.replace('.bag', '.mcap');

        // convert to bag and upload to minio
        if (sourceIsBag) {
            bagFileEntity = await this.fileRepository.save(existingFileEntity);
            logger.debug(`Convert file ${queue.identifier} from bag to mcap`);
            mcapExists = await this.fileRepository.exists({
                where: {
                    mission: { uuid: queue.mission.uuid },
                    filename: mcapFilename,
                },
            });
            if (!mcapExists) {
                const tentativeMCAP = this.fileRepository.create({
                    date: new Date(),
                    mission: queue.mission,
                    size: 0,
                    filename: mcapFilename,
                    creator: queue.creator,
                    type: FileType.MCAP,
                    state: FileState.UPLOADING,
                    origin: FileOrigin.CONVERTED,
                    relatedFile: bagFileEntity,
                });
                mcapFileEntity = await this.fileRepository.save(tentativeMCAP);
                bagFileEntity.relatedFile = mcapFileEntity;
                await this.fileRepository.save(bagFileEntity);

                // ------------- Convert to MCAP -------------
                const tmp_file_name_mcap = await convertToMcap(
                    tmp_file_name,
                ).catch(async (error) => {
                    logger.error(`Error converting file, possibly corrupted!`);
                    queue.state = QueueState.CORRUPTED;
                    await this.queueRepository.save(queue);
                    bagFileEntity.state = FileState.CONVERSION_ERROR;
                    await this.fileRepository.save(bagFileEntity);
                    await this.fileRepository.remove(mcapFileEntity);
                    throw error;
                });
                mcapHash = await calculateFileHash(tmp_file_name_mcap);

                // ------------- Upload to Minio -------------
                queue.state = QueueState.UPLOADING;
                await this.queueRepository.save(queue);
                const full_pathname_mcap = queue.identifier.replace(
                    '.bag',
                    '.mcap',
                );
                await uploadLocalFile(
                    env.MINIO_MCAP_BUCKET_NAME,
                    mcapFileEntity.uuid,
                    mcapFileEntity.filename,
                    tmp_file_name_mcap,
                ).catch(async (error) => {
                    logger.error(`Error converting file, possibly corrupted!`);
                    queue.state = QueueState.ERROR;
                    await this.queueRepository.save(queue);
                    mcapFileEntity.state = FileState.ERROR;
                    await this.fileRepository.save(mcapFileEntity);
                    throw error;
                });

                // set tag inside minio
                await addTagsToMinioObject(
                    env.MINIO_MCAP_BUCKET_NAME,
                    mcapFileEntity.uuid,
                    {
                        missionUuid: queue.mission.uuid,
                        projectUuid: queue.mission.project.uuid,
                    },
                );

                job.data.tmp_files.push(mcap_temp_file_name); // saved for cleanup

                mcapFileEntity.size = fs.statSync(mcap_temp_file_name).size;
                mcapFileEntity.hash = mcapHash;
            }
        } else {
            mcapFileEntity = existingFileEntity;
        }

        ////////////////////////////////////////////////////////////////
        // Extract Topics from MCAP file
        ////////////////////////////////////////////////////////////////
        let date: Date;
        if (!mcapExists) {
            date = await this.extractTopics(
                job,
                queue,
                mcapFileEntity,
                mcap_temp_file_name,
            );
        } else {
            const existingMCAP = await this.fileRepository.findOneOrFail({
                where: {
                    mission: { uuid: queue.mission.uuid },
                    filename: mcapFilename,
                },
            });
            date = existingMCAP.date;
        }

        ////////////////////////////////////////////////////////////////
        // Update recording date
        ////////////////////////////////////////////////////////////////
        if (sourceIsBag) {
            bagFileEntity.hash = bagHash;
            bagFileEntity.size = size;
            bagFileEntity.date = date;
            if (job.data.recovering) {
                bagFileEntity.state = FileState.FOUND;
            } else {
                bagFileEntity.state = FileState.OK;
            }
            await this.fileRepository.save(bagFileEntity);
        }

        if (!mcapExists) {
            mcapFileEntity.size = size;
            mcapFileEntity.hash = mcapHash;
            mcapFileEntity.date = date;
            if (job.data.recovering) {
                mcapFileEntity.state = FileState.FOUND;
            } else {
                mcapFileEntity.state = FileState.OK;
            }
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

        logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
        const queueEntity = await this.startProcessing(job.data.queueUuid);

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
                `Job {${job.id}} is a folder: ${originalFileName}, processing...`,
            );

            // save the display name
            queueEntity.display_name = `Google Drive Folder: '${originalFileName}'`;
            await this.queueRepository.save(queueEntity);

            return await this.processDriveFolder(job, queueEntity);
        }
        // it's a file, process it
        logger.debug(
            `Job {${job.id}} is a file: ${originalFileName}, processing...`,
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
                `Job {${job.id}} file ${originalFileName} already exists`,
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
                `Job {${job.id}} file ${originalFileName} is not a .bag or .mcap file`,
            );
            return false;
        }

        const file_type = originalFileName.endsWith('.bag') ? 'bag' : 'mcap';
        const tmp_file_name = `/tmp/${queueEntity.identifier}.${file_type}`;
        job.data.tmp_files.push(tmp_file_name); // saved for cleanup
        queueEntity.state = QueueState.DOWNLOADING;
        await this.queueRepository.save(queueEntity);

        const filehash = await traceWrapper(async () => {
            return await downloadDriveFile(
                queueEntity.identifier,
                tmp_file_name,
            );
        }, 'downloadDriveFile')();

        queueEntity.state = QueueState.PROCESSING;
        await this.queueRepository.save(queueEntity);

        logger.debug(`Job {${job.id}} downloaded file: ${originalFileName}`);

        ////////////////////////////////////////////////////////////////
        // Process the tmp file
        ////////////////////////////////////////////////////////////////

        await this.processTmpFile(
            job,
            queueEntity,
            tmp_file_name,
            originalFileName,
            filehash,
        );
        return true; // return true to indicate that the job is done
    }

    @tracing('processTmpFile')
    private async processTmpFile(
        job: FileProcessorJob,
        queueEntity: QueueEntity,
        tmpFileName: string,
        originalFileName: string,
        filehash: string,
    ) {
        // validate that the tmp file exists
        if (!fs.existsSync(tmpFileName))
            throw new Error(`File ${tmpFileName} does not exist`);
        const sourceIsBag = originalFileName.endsWith('.bag');
        const file_type = sourceIsBag ? 'bag' : 'mcap';

        // validate that the tmp file is of the correct type
        if (!tmpFileName.endsWith(`.${file_type}`))
            throw new Error(`File ${tmpFileName} is not a ${file_type} file`);

        ////////////////////////////////////////////////////////////////
        // Upload file to Minio (and convert to mcap if necessary)
        ////////////////////////////////////////////////////////////////

        let bagFileEntity: FileEntity | undefined;
        let mcapFileEntity: FileEntity | undefined;
        const newFileEntity = this.fileRepository.create({
            date: new Date(),
            mission: queueEntity.mission,
            size: fs.statSync(tmpFileName).size,
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

        logger.debug(`Job {${job.id}} uploaded file: ${originalFileName}`);

        // convert to bag to mcap and upload to minio
        if (sourceIsBag) {
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
            const tmp_file_name_mcap = await convertToMcap(tmpFileName).catch(
                async (error) => {
                    logger.error(
                        `Error converting file ${queueEntity.identifier} to mcap: ${error}`,
                    );
                    queueEntity.state = QueueState.CORRUPTED;
                    await this.queueRepository.save(queueEntity);
                    bagFileEntity.state = FileState.CONVERSION_ERROR;
                    await this.fileRepository.save(bagFileEntity);
                    await this.fileRepository.remove(mcapFileEntity);
                    throw error;
                },
            );

            const mcapHash = await calculateFileHash(tmp_file_name_mcap);

            // ------------- Upload to Minio -------------
            queueEntity.state = QueueState.UPLOADING;
            await this.queueRepository.save(queueEntity);

            await uploadLocalFile(
                env.MINIO_MCAP_BUCKET_NAME,
                mcapFileEntity.uuid,
                mcapFileEntity.filename,
                tmp_file_name_mcap,
            ).catch(async (error) => {
                logger.error(`Error converting file, possibly corrupted!`);
                queueEntity.state = QueueState.ERROR;
                await this.queueRepository.save(queueEntity);
                mcapFileEntity.state = FileState.ERROR;
                await this.fileRepository.save(mcapFileEntity);
                throw error;
            });

            // set tag inside minio
            await addTagsToMinioObject(
                env.MINIO_MCAP_BUCKET_NAME,
                mcapFileEntity.uuid,
                {
                    missionUuid: queueEntity.mission.uuid,
                    projectUuid: queueEntity.mission.project.uuid,
                },
            );

            logger.debug(`File ${originalFileName} converted successfully`);
            mcapFileEntity.size = fs.statSync(tmp_file_name_mcap).size;
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
            tmpFileName,
        );

        // set tag inside minio
        await addTagsToMinioObject(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            savedFileEntity.uuid,
            {
                missionUuid: queueEntity.mission.uuid,
                projectUuid: queueEntity.mission.project.uuid,
            },
        );

        const mcap_temp_file_name = tmpFileName.replace('.bag', '.mcap');
        job.data.tmp_files.push(mcap_temp_file_name); // saved for cleanup

        ////////////////////////////////////////////////////////////////
        // Extract Topics from MCAP file
        ////////////////////////////////////////////////////////////////

        const date = await this.extractTopics(
            job,
            queueEntity,
            mcapFileEntity,
            mcap_temp_file_name,
        );

        ////////////////////////////////////////////////////////////////
        // Update recording date
        ////////////////////////////////////////////////////////////////
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
        tmp_file_name: string,
    ) {
        if (!tmp_file_name.endsWith('.mcap'))
            throw new Error(
                `File ${tmp_file_name} is not an mcap file, cannot extract topics`,
            );

        if (!fs.existsSync(tmp_file_name))
            throw new Error(`File ${tmp_file_name} does not exist`);

        if (savedFile.type !== FileType.MCAP)
            throw new Error(
                `File ${savedFile.filename} is not an mcap file, cannot extract topics`,
            );

        const meta = await mcapMetaInfo(tmp_file_name).catch(async (error) => {
            logger.error(
                `Error extracting topics from file ${tmp_file_name}: ${error}`,
            );
            queueEntity.state = QueueState.CORRUPTED;
            await this.queueRepository.save(queueEntity);
            savedFile.state = FileState.CORRUPTED;
            await this.fileRepository.save(savedFile);
            throw error;
        });
        const { topics, date, size } = meta;
        logger.debug(`Job {${job.id}} saved file: ${savedFile.filename}`);

        const res = topics.map(async (topic) => {
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

        const createdTopics = await Promise.all(res);
        logger.debug(
            `Job {${job.id}} created topics: ${createdTopics.map((topic) => topic.name)}`,
        );
        return date;
    }

    @tracing('processDriveFolder')
    private async processDriveFolder(
        job: FileProcessorJob,
        queue: QueueEntity,
    ) {
        logger.debug(`Job {${job.id}} is a folder, processing...`);
        const files: drive_v3.Schema$File[] | void = await listFiles(
            queue.identifier,
        );
        logger.debug(
            `Job {${job.id}} found files: ${files.map((file) => file.name)}`,
        );

        await Promise.all(
            files.map(async (file) => {
                // create new queue entity
                if (
                    file.name.endsWith('.bag') ||
                    file.name.endsWith('.mcap') ||
                    file.mimeType === 'application/vnd.google-apps.folder'
                ) {
                    const newQueue = this.queueRepository.create({
                        display_name: `Google Drive File: '${file.name}'`,
                        identifier: file.id,
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

    private async startProcessing(queueUuid: string) {
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
