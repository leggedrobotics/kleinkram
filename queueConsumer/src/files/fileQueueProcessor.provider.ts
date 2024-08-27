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
import {
    downloadMinioFile,
    getInfoFromMinio,
    uploadFile,
} from './helper/minioHelper';
import logger from '../logger';
import { traceWrapper, tracing } from '../tracing';
import QueueEntity from '@common/entities/queue/queue.entity';
import FileEntity from '@common/entities/file/file.entity';
import Topic from '@common/entities/topic/topic.entity';
import env from '@common/env';
import { FileLocation, FileState, FileType } from '@common/enum';
import { drive_v3 } from 'googleapis';
import fs from 'node:fs';

const fs_promises = require('fs').promises;

type FileProcessorJob = Job<{
    queueUuid: string;
    tmp_files: string[];
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
        queue.state = FileState.COMPLETED;
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
        if (queue.state != FileState.CORRUPTED) queue.state = FileState.ERROR;
        queue.processingDuration = job.finishedOn - job.processedOn;
        await this.queueRepository.save(queue);

        await this.deleteTmpFiles(job);
    }

    @Process({ concurrency: 1, name: 'processMinioFile' })
    @tracing('processMinioFile')
    async handleMinioFileProcessing(job: FileProcessorJob) {
        logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
        let queue = await this.startProcessing(job.data.queueUuid);
        const sourceIsBag = queue.filename.endsWith('.bag');

        const uuid = crypto.randomUUID();
        let tmp_file_name = `/tmp/${uuid}.${sourceIsBag ? 'bag' : 'mcap'}`;
        job.data.tmp_files.push(tmp_file_name); // saved for cleanup

        queue.state = FileState.DOWNLOADING;
        queue = await this.queueRepository.save(queue);

        await traceWrapper(async () => {
            return await downloadMinioFile(
                sourceIsBag
                    ? env.MINIO_BAG_BUCKET_NAME
                    : env.MINIO_MCAP_BUCKET_NAME,
                queue.identifier,
                tmp_file_name,
            );
        }, 'downloadMinioFile')();

        queue.state = FileState.CONVERTING_AND_EXTRACTING_TOPICS;
        queue = await this.queueRepository.save(queue);

        logger.debug(`Job ${job.id} downloaded file: ${queue.identifier}`);
        const originalFileName = queue.filename.split('/').pop();

        let bagFileEntity: FileEntity | undefined;
        let mcapFileEntity: FileEntity | undefined;

        const mcap_temp_file_name = tmp_file_name.replace('.bag', '.mcap');

        const existingFileEntity = await this.fileRepository.findOne({
            where: {
                filename: originalFileName,
                mission: { uuid: queue.mission.uuid },
            },
        });

        // convert to bag and upload to minio
        if (sourceIsBag) {
            bagFileEntity = existingFileEntity;
            logger.debug(`Convert file ${queue.identifier} from bag to mcap`);
            const tentativeMCAP = this.fileRepository.create({
                date: new Date(),
                mission: queue.mission,
                size: 0,
                filename: originalFileName.replace('.bag', '.mcap'),
                creator: queue.creator,
                type: FileType.MCAP,
                tentative: true,
            });
            mcapFileEntity = await this.fileRepository.save(tentativeMCAP);

            // ------------- Convert to MCAP -------------
            const tmp_file_name_mcap = await convertToMcap(tmp_file_name).catch(
                async (error) => {
                    logger.error(`Error converting file, possibly corrupted!`);
                    queue.state = FileState.CORRUPTED;
                    await this.queueRepository.save(queue);
                    throw error;
                },
            );

            // ------------- Upload to Minio -------------
            queue.state = FileState.UPLOADING;
            await this.queueRepository.save(queue);
            const full_pathname_mcap = queue.identifier.replace(
                '.bag',
                '.mcap',
            );
            await uploadFile(
                env.MINIO_MCAP_BUCKET_NAME,
                full_pathname_mcap,
                tmp_file_name_mcap,
            ).catch(async (error) => {
                logger.error(`Error converting file, possibly corrupted!`);
                queue.state = FileState.ERROR;
                await this.queueRepository.save(queue);
                throw error;
            });

            job.data.tmp_files.push(mcap_temp_file_name); // saved for cleanup

            mcapFileEntity.size = fs.statSync(mcap_temp_file_name).size;
        } else {
            mcapFileEntity = existingFileEntity;
        }

        ////////////////////////////////////////////////////////////////
        // Extract Topics from MCAP file
        ////////////////////////////////////////////////////////////////

        const date = await this.extractTopics(
            job,
            queue,
            mcapFileEntity,
            mcap_temp_file_name,
        );

        ////////////////////////////////////////////////////////////////
        // Update recording date
        ////////////////////////////////////////////////////////////////
        if (sourceIsBag) {
            bagFileEntity.date = date;
            bagFileEntity.tentative = false;
            await this.fileRepository.save(bagFileEntity);
        }
        mcapFileEntity.date = date;
        mcapFileEntity.tentative = false;
        await this.fileRepository.save(mcapFileEntity);
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
            return await this.processDriveFolder(job, queueEntity);
        }
        // it's a file, process it
        logger.debug(
            `Job {${job.id}} is a file: ${originalFileName}, processing...`,
        );
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
            queueEntity.state = FileState.ERROR;
            await this.queueRepository.save(queueEntity);
            logger.error(
                `Job {${job.id}} file ${originalFileName} already exists`,
            );
            return false;
        }

        const file_type = originalFileName.endsWith('.bag') ? 'bag' : 'mcap';

        let tmp_file_name = `/tmp/${queueEntity.identifier}.${file_type}`;
        job.data.tmp_files.push(tmp_file_name); // saved for cleanup
        queueEntity.state = FileState.DOWNLOADING;
        await this.queueRepository.save(queueEntity);

        await traceWrapper(async () => {
            return await downloadDriveFile(
                queueEntity.identifier,
                tmp_file_name,
            );
        }, 'downloadDriveFile')();

        queueEntity.state = FileState.PROCESSING;
        queueEntity.filename = originalFileName;
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
        );
        return true; // return true to indicate that the job is done
    }

    @tracing('processTmpFile')
    private async processTmpFile(
        job: FileProcessorJob,
        queueEntity: QueueEntity,
        tmpFileName: string,
        originalFileName: string,
    ) {
        // validate that the tmp file exists
        if (!fs.existsSync(tmpFileName))
            throw new Error(`File ${tmpFileName} does not exist`);
        const sourceIsBag = originalFileName.endsWith('.bag');
        const file_type = sourceIsBag ? 'bag' : 'mcap';

        // validate that the tmp file is of the correct type
        if (!tmpFileName.endsWith(`.${file_type}`))
            throw new Error(`File ${tmpFileName} is not a ${file_type} file`);

        const project_name = queueEntity.mission.project.name;
        const mission_name = queueEntity.mission.name;
        const full_pathname = `${project_name}/${mission_name}/${originalFileName}`;

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
            tentative: true,
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
                tentative: true,
            });
            mcapFileEntity = await this.fileRepository.save(newMCAP);

            // ------------- Convert to MCAP -------------

            queueEntity.state = FileState.CONVERTING_AND_EXTRACTING_TOPICS;
            await this.queueRepository.save(queueEntity);
            const tmp_file_name_mcap = await convertToMcap(tmpFileName).catch(
                async (error) => {
                    logger.error(
                        `Error converting file ${queueEntity.identifier} to mcap: ${error}`,
                    );
                    queueEntity.state = FileState.CORRUPTED;
                    await this.queueRepository.save(queueEntity);
                    throw error;
                },
            );

            // ------------- Upload to Minio -------------
            queueEntity.state = FileState.UPLOADING;
            await this.queueRepository.save(queueEntity);

            const full_pathname_mcap = full_pathname.replace('.bag', '.mcap');
            await uploadFile(
                env.MINIO_MCAP_BUCKET_NAME,
                full_pathname_mcap,
                tmp_file_name_mcap,
            ).catch(async (error) => {
                logger.error(`Error converting file, possibly corrupted!`);
                queueEntity.state = FileState.ERROR;
                await this.queueRepository.save(queueEntity);
                throw error;
            });

            logger.debug(`File ${originalFileName} converted successfully`);
            const fileInfo = await getInfoFromMinio(
                FileType.MCAP,
                full_pathname,
            );
            mcapFileEntity.size = fileInfo.size;
            mcapFileEntity.tentative = false;
            mcapFileEntity = await this.fileRepository.save(mcapFileEntity);
        }
        queueEntity.state = FileState.UPLOADING;
        await this.queueRepository.save(queueEntity);

        logger.debug(`Uploading file: ${originalFileName} to Minio`);
        await uploadFile(
            sourceIsBag
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            full_pathname,
            tmpFileName,
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
            bagFileEntity.tentative = false;
            await this.fileRepository.save(bagFileEntity);
        }
        mcapFileEntity.tentative = false;
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
            queueEntity.state = FileState.CORRUPTED;
            await this.queueRepository.save(queueEntity);
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
                    const exists = await this.queueRepository.exists({
                        where: {
                            filename: file.name,
                            mission: { uuid: queue.mission.uuid },
                        },
                    });
                    let newQueue: QueueEntity;
                    if (exists) {
                        newQueue = this.queueRepository.create({
                            filename: file.name,
                            identifier: file.id,
                            state: FileState.ERROR,
                            location: FileLocation.DRIVE,
                            mission: queue.mission,
                            creator: queue.creator,
                        });
                        await this.queueRepository.save(newQueue);
                        return;
                    } else {
                        newQueue = this.queueRepository.create({
                            filename: file.name,
                            identifier: file.id,
                            state: FileState.AWAITING_PROCESSING,
                            location: FileLocation.DRIVE,
                            mission: queue.mission,
                            creator: queue.creator,
                        });
                    }
                    await this.queueRepository.save(newQueue);

                    await this.fileQueue.add('processDriveFile', {
                        queueUuid: newQueue.uuid,
                    });
                }
            }),
        );
        queue.state = FileState.COMPLETED;
        await this.queueRepository.save(queue);
    }

    private async startProcessing(queueUuid: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: {
                uuid: queueUuid,
            },
            relations: ['mission', 'creator', 'mission.project'],
        });
        queue.state = FileState.PROCESSING;
        await this.queueRepository.save(queue);
        return queue;
    }
}
