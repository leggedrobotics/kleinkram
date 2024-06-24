import { InjectQueue, OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import QueueEntity from './entities/queue.entity';
import FileEntity from './entities/file.entity';
import env from './env';
import { convert, mcapMetaInfo } from './helper/converter';
import { downloadDriveFile, getMetadata, listFiles } from './helper/driveHelper';
import { downloadMinioFile, uploadFile } from './helper/minioHelper';
import Topic from './entities/topic.entity';
import { FileLocation, FileState, FileType } from './enum';
import logger from './logger';
import { traceWrapper } from './tracing';
import { drive_v3 } from 'googleapis';

const fs_promises = require('fs').promises;

async function saveAsMcap(tmp_file_name: string, full_pathname: string): Promise<boolean> {
    return await traceWrapper(async () => {
        const tmp_file_name_mcap = tmp_file_name.replace('.bag', '.mcap');
        const full_pathname_mcap = full_pathname.replace('.bag', '.mcap');

        logger.debug(`Converting file ${tmp_file_name} from bag to mcap ${tmp_file_name_mcap}`);
        await convert(tmp_file_name, tmp_file_name_mcap);
        logger.debug('File converted successfully');

        return await uploadFile(
            env.MINIO_MCAP_BUCKET_NAME,
            full_pathname_mcap,
            tmp_file_name_mcap,
        );

    }, 'processFile')();
}

@Processor('file-queue')
@Injectable()
export class FileProcessor implements OnModuleInit {
    constructor(
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
        @InjectQueue('action-queue') private readonly analysisQueue: Queue,
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
            await this.analysisQueue.isReady();
            logger.debug('Connected to Redis successfully!');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        logger.debug(`Processing job ${job.id} of type ${job.name}.`);
    }

    @Process({ concurrency: 1, name: 'processMinioFile' })
    async handleMinioFileProcessing(job: Job<{ queueUuid: string }>) {
        return await traceWrapper(async () => {
            logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
            const queue = await this.startProcessing(job.data.queueUuid);
            const sourceIsBag = queue.filename.endsWith('.bag');

            const uuid = crypto.randomUUID();
            let tmp_file_name = `/tmp/${uuid}.${sourceIsBag ? 'bag' : 'mcap'}`;
            let succeded = await downloadMinioFile(
                sourceIsBag
                    ? env.MINIO_BAG_BUCKET_NAME
                    : env.MINIO_MCAP_BUCKET_NAME,
                queue.identifier,
                tmp_file_name,
            ).catch((error) => {
                logger.error(`Error downloading file: ${queue.identifier} to ${tmp_file_name}`);
                logger.error(error);
                queue.state = FileState.ERROR;
                this.queueRepository.save(queue);
            });

            if (!succeded) return null;
            logger.debug(`Job ${job.id} downloaded file: ${queue.identifier}`);

            queue.state = FileState.LOADED;
            await this.queueRepository.save(queue);

            if (sourceIsBag) {

                // convert to bag and upload to minio
                logger.debug(`Convert file ${queue.identifier} from bag to mcap`);
                const succeeded = await saveAsMcap(tmp_file_name, queue.identifier)
                    .catch((error) => {
                        logger.error(`Error converting file: ${queue.identifier}`);
                        logger.error(error);
                        queue.state = FileState.CORRUPTED_FILE;
                        this.queueRepository.save(queue);
                        fs_promises.unlink(tmp_file_name);
                    });

                if (!succeeded) return null;

            }

            tmp_file_name = tmp_file_name.replace('.bag', '.mcap');
            const meta = await mcapMetaInfo(tmp_file_name).catch(
                (error) => {
                    logger.error(`Error extracting topics from file: ${tmp_file_name}`);
                    logger.error(error);
                    queue.state = FileState.ERROR;
                    this.queueRepository.save(queue);
                    fs_promises.unlink(tmp_file_name);
                });

            if (!meta) return null;
            const { topics, date, size } = meta;

            const newFile = this.fileRepository.create({
                date,
                mission: queue.mission,
                size: size as number,
                filename: queue.filename.replace('.bag', '.mcap'),
                creator: queue.creator,
                type: FileType.MCAP,
            });
            const savedFile = await this.fileRepository.save(newFile);
            logger.debug(
                `Job {${job.id}} saved file: ${savedFile.filename}`,
            );

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
            console.log('created topics', createdTopics);
            logger.debug(`Job {${job.id}} created topics: ${createdTopics.map((topic) => topic.name)}`);

            if (sourceIsBag) {
                const newFile = this.fileRepository.create({
                    date,
                    mission: queue.mission,
                    size,
                    filename: queue.filename,
                    creator: queue.creator,
                    type: FileType.BAG,
                });
                await this.fileRepository.save(newFile);
            }

            queue.state = FileState.DONE;
            await this.queueRepository.save(queue);
            logger.debug(`Job {${job.id}} saved file: ${savedFile}`);
            return savedFile;

        }, 'processMinioFile')();
    }

    @Process({ name: 'processDriveFile', concurrency: 1 })
    async handleDriveFileProcessing(job: Job<{ queueUuid: string }>) {
        return await traceWrapper(async () => {

            ////////////////////////////////////////////////////////////////////
            // Extract Metadata from Google Drive
            ////////////////////////////////////////////////////////////////////

            logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
            const queue = await this.startProcessing(job.data.queueUuid);

            const metadataRes = await getMetadata(queue.identifier)
                .catch((error) => {
                    logger.error(`Error getting metadata for file: ${queue.identifier}`);
                    logger.error(error);
                    queue.state = FileState.ERROR;
                    this.queueRepository.save(queue);
                });

            if (!metadataRes) return null;
            logger.debug(`Metadata for file ${queue.identifier} is:\n  » ${metadataRes.name}`);

            ////////////////////////////////////////////////////////////////////
            // Download file from Google Drive
            ////////////////////////////////////////////////////////////////////

            const filename = metadataRes.name;
            const project_name = queue.mission.project.name;
            const mission_name = queue.mission.name;
            const full_pathname = `${project_name}/${mission_name}/${filename}`;

            if (metadataRes.mimeType === 'application/vnd.google-apps.folder') {

                logger.debug(`Job {${job.id}} is a folder: ${metadataRes.name}, processing...`);
                return await this.processDriveFolder(job, queue)
                    .catch((error) => {
                        logger.error(`Error processing folder: ${queue.identifier}`);
                        logger.error(error);
                        queue.state = FileState.ERROR;
                        this.queueRepository.save(queue);
                    });

            }

            logger.debug(`Job {${job.id}} is a file: ${metadataRes.name}, processing...`);

            const file_type = metadataRes.name.endsWith('.bag') ? 'bag' : 'mcap';
            let tmp_file_name = `/tmp/${queue.identifier}.${file_type}`;

            let succeeded = await downloadDriveFile(queue.identifier, tmp_file_name).catch(
                (error) => {
                    logger.error(`Error downloading file: ${queue.identifier}`);
                    logger.error(error);
                    queue.state = FileState.ERROR;
                    this.queueRepository.save(queue);
                    fs_promises.unlink(tmp_file_name);
                });

            if (!succeeded) return null;

            queue.state = FileState.LOADED;
            await this.queueRepository.save(queue);
            logger.debug(`Job {${job.id}} downloaded file: ${metadataRes.name}`);

            ////////////////////////////////////////////////////////////////
            // Upload file to Minio
            ////////////////////////////////////////////////////////////////

            logger.debug(`Uploading file: ${metadataRes.name} to Minio`);
            succeeded = await uploadFile(
                file_type === 'bag' ? env.MINIO_BAG_BUCKET_NAME : env.MINIO_MCAP_BUCKET_NAME,
                full_pathname,
                tmp_file_name,
            ).catch((error) => {
                logger.error(`Error uploading file: ${metadataRes.name}`);
                logger.error(error);
                queue.state = FileState.ERROR;
                this.queueRepository.save(queue);
                fs_promises.unlink(tmp_file_name);
            });

            if (!succeeded) return null;
            logger.debug(`Job {${job.id}} uploaded file: ${metadataRes.name}`);

            if (file_type === 'bag') {

                // convert to bag and upload to minio
                logger.debug(`Convert file ${metadataRes.name} from bag to mcap`);
                const succeeded = await saveAsMcap(tmp_file_name, full_pathname)
                    .catch((error) => {
                        logger.error(`Error converting file: ${metadataRes.name}`);
                        logger.error(error);
                        queue.state = FileState.CORRUPTED_FILE;
                        this.queueRepository.save(queue);
                        fs_promises.unlink(tmp_file_name);
                    });

                if (!succeeded) return null;
                logger.debug(`File ${metadataRes.name} converted successfully`);

            }

            ////////////////////////////////////////////////////////////////
            // Extract Topics from MCAP file
            ////////////////////////////////////////////////////////////////

            tmp_file_name = tmp_file_name.replace('.bag', '.mcap');
            const meta = await mcapMetaInfo(tmp_file_name).catch(
                (error) => {
                    logger.error(`Error extracting topics from file: ${tmp_file_name}`);
                    logger.error(error);
                    queue.state = FileState.ERROR;
                    this.queueRepository.save(queue);
                    fs_promises.unlink(tmp_file_name);
                });

            if (!meta) return null;
            const { topics, date, size } = meta;

            ////////////////////////////////////////////////////////////////
            // Save file and topics to database
            ////////////////////////////////////////////////////////////////

            const newFile = this.fileRepository.create({
                date,
                mission: queue.mission,
                size: size as number,
                filename: filename.replace('.bag', '.mcap'),
                creator: queue.creator,
                type: FileType.MCAP,
            });
            const savedFile = await this.fileRepository.save(newFile);
            logger.debug(
                `Job {${job.id}} saved file: ${savedFile.filename}`,
            );

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
            console.log('created topics', createdTopics);
            logger.debug(`Job {${job.id}} created topics: ${createdTopics.map((topic) => topic.name)}`);

            if (metadataRes.name.endsWith('.bag')) {
                const newFile = this.fileRepository.create({
                    date,
                    mission: queue.mission,
                    size,
                    filename: metadataRes.name,
                    creator: queue.creator,
                    type: FileType.BAG,
                });
                await this.fileRepository.save(newFile);
            }

            queue.state = FileState.DONE;
            await this.queueRepository.save(queue);
            logger.debug(`Job {${job.id}} saved file: ${savedFile}`);
            return savedFile;


        }, 'processDriveFile')();
    }

    private async processDriveFolder(job: Job<{ queueUuid: string }>, queue: QueueEntity) {
        logger.debug(`Job {${job.id}} is a folder, processing...`);
        const files: drive_v3.Schema$File[] | void = await listFiles(queue.identifier)
            .catch((error) => {
                logger.error(`Error getting files in folder: ${queue.identifier}`);
                logger.error(error);
                logger.error(error.stack);
                queue.state = FileState.ERROR;
                this.queueRepository.save(queue);
            });

        if (!files) return null;
        logger.debug(`Job {${job.id}} found files: ${files.map((file) => file.name)}`);

        await Promise.all(
            files.map(async (file) => {
                if (file.name.endsWith('.bag')) {
                    const newQueue = this.queueRepository.create({
                        filename: file.name,
                        identifier: file.id,
                        state: FileState.PENDING,
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
        queue.state = FileState.DONE;
        await this.queueRepository.save(queue);
        return;
    }

    async startProcessing(queueUuid: string) {
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
