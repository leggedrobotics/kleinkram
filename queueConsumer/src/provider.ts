import { InjectQueue, OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import QueueEntity from './entities/queue.entity';
import Run from './entities/run.entity';
import FileEntity from './entities/file.entity';
import env from './env';
import { convert, mcapMetaInfo } from './helper/converter';
import { downloadDriveFile, getMetadata, listFiles } from './helper/driveHelper';
import { deleteMinioFile, downloadMinioFile, moveMinioFile, uploadFile } from './helper/minioHelper';
import Topic from './entities/topic.entity';
import { FileLocation, FileState } from './enum';
import logger from './logger';
import { traceWrapper } from './tracing';

const fs = require('fs').promises;

async function processFile(buffer: Buffer, fileName: string) {

  return await traceWrapper(async () => {

      const tempFilePath = `/tmp/tempfile-${Date.now()}.bag`;
      await fs.writeFile(tempFilePath, buffer);
      const mcapPath = tempFilePath.replace('.bag', '.mcap');

      const convertedBuffer = await convert(tempFilePath, mcapPath);


      // Read converted file and upload
      await uploadFile(env.MINIO_BAG_BUCKET_NAME, fileName, convertedBuffer);

      // Optionally, clean up temporary files
      await fs.unlink(tempFilePath);
      await fs.unlink(mcapPath);
      return convertedBuffer;
    }, 'processFile'
  )();

}


@Processor('file-queue')
@Injectable()
export class FileProcessor implements OnModuleInit {
  constructor(
    @InjectQueue('file-queue') private readonly fileQueue: Queue,
    @InjectRepository(QueueEntity) private queueRepository: Repository<QueueEntity>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(FileEntity) private fileRepository: Repository<FileEntity>,
    @InjectRepository(Topic) private topicRepository: Repository<Topic>
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

  @OnQueueActive()
  onActive(job: Job) {
    logger.debug(`Processing job ${job.id} of type ${job.name}.`);
  }

  @Process('processMinioFile')
  async handleMinioFileProcessing(job: Job<{ queueUuid: string }>) {

    return await traceWrapper(async () => {


      logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
      const queue = await this.startProcessing(job.data.queueUuid);
      try {
        let buffer = await downloadMinioFile(env.MINIO_TEMP_BAG_BUCKET_NAME, queue.identifier);
        let filename = queue.identifier;
        if (filename.endsWith('.mcap')) {
          await moveMinioFile(env.MINIO_TEMP_BAG_BUCKET_NAME, env.MINIO_BAG_BUCKET_NAME, queue.identifier);
        } else if (filename.endsWith('.bag')) {
          filename = queue.identifier.replace('.bag', '.mcap');
          buffer = await processFile(buffer, filename);
          await deleteMinioFile(env.MINIO_TEMP_BAG_BUCKET_NAME, queue.identifier);
        } else {
          throw new Error('Invalid file extension');
        }
        const { topics, date, size } = await mcapMetaInfo(buffer);


        const res = topics.map(async (topic) => {
          const newTopic = this.topicRepository.create(topic);
          await this.topicRepository.save(newTopic);

          return this.topicRepository.findOne({ where: { uuid: newTopic.uuid } });
        });
        const createdTopics = await Promise.all(res);

        const newFile = this.fileRepository.create({
          identifier: filename,
          date,
          topics: createdTopics,
          run: queue.run,
          size,
          filename
        });
        const savedFile = await this.fileRepository.save(newFile);
        queue.state = FileState.DONE;
        await this.queueRepository.save(queue);
        return savedFile;
      } catch (error) {
        queue.state = FileState.ERROR;
        await this.queueRepository.save(queue);
        logger.error(`Error processing file: ${queue.identifier}`);
        throw error;
      }
    }, 'processMinioFile')();

  }

  @Process('processDriveFile')
  async handleDriveFileProcessing(job: Job<{ queueUuid: string }>) {
    return await traceWrapper(async () => {

      logger.debug(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
      const queue = await this.startProcessing(job.data.queueUuid);

      let metadataRes = null;
      try {
        metadataRes = await getMetadata(queue.identifier);
      } catch (error) {
        logger.error(`Error getting metadata for file: ${queue.identifier}`);
        logger.error(error);
        logger.error(error.stack);
        queue.state = FileState.ERROR;
        await this.queueRepository.save(queue);

        return null;
      }

      if (!metadataRes) {
        logger.error(`Error getting metadata for file: ${queue.identifier}`);
        logger.error('Metadata is null');
        queue.state = FileState.ERROR;
        await this.queueRepository.save(queue);

        return null;
      }
      const filename = metadataRes.name.replace('.bag', '.mcap')
      if (metadataRes.mimeType !== 'application/vnd.google-apps.folder') {
        logger.debug(`Job {${job.id}} is a file: ${metadataRes.name}, processing...`);
        try {
          let buffer = await downloadDriveFile(queue.identifier);
          logger.debug(`Job {${job.id}} downloaded file: ${metadataRes.name}`);
          if (metadataRes.name.endsWith('.mcap')) {
            await uploadFile(env.MINIO_BAG_BUCKET_NAME, metadataRes.name, buffer);
            logger.debug(`Job {${job.id}} uploaded file: ${metadataRes.name}`);
          } else if (metadataRes.name.endsWith('.bag')) {
            buffer = await processFile(buffer, filename);
            logger.debug(`Job {${job.id}} processed file: ${filename}`);
          } else {
            throw new Error('Invalid file extension');
          }
          const { topics, date, size } = await mcapMetaInfo(buffer);

          const res = topics.map(async (topic) => {
            const newTopic = this.topicRepository.create(topic);
            await this.topicRepository.save(newTopic);

            return this.topicRepository.findOne({ where: { uuid: newTopic.uuid } });
          });
          const createdTopics = await Promise.all(res);
          logger.debug(`Job {${job.id}} created topics: ${createdTopics.map((topic) => topic.name)}`);
          const newFile = this.fileRepository.create({
            identifier: queue.identifier,
            date,
            topics: createdTopics,
            run: queue.run,
            size,
            filename: filename
          });
          const savedFile = await this.fileRepository.save(newFile);
          queue.state = FileState.DONE;
          await this.queueRepository.save(queue);
          logger.debug(`Job {${job.id}} saved file: ${savedFile}`);
          return savedFile;
        } catch (error) {
          queue.state = FileState.ERROR;
          await this.queueRepository.save(queue);
          throw error;
        }
      } else {
        logger.debug(`Job {${job.id}} is a folder, processing...`);

        const files = await listFiles(queue.identifier);
        await Promise.all(files.map(async (file) => {
          if (file.name.endsWith('.bag')) {
            const newQueue = this.queueRepository.create({
              filename: file.name,
              identifier: file.id,
              state: FileState.PENDING,
              location: FileLocation.DRIVE,
              run: queue.run
            });
            await this.queueRepository.save(newQueue);

            await this.fileQueue.add('processDriveFile', {
              queueUuid: newQueue.uuid
            });
          }

        }));
        queue.state = FileState.DONE;
        await this.queueRepository.save(queue);
      }
    }, 'processDriveFile')();

  }

  async startProcessing(queueUuid: string) {
    const queue = await this.queueRepository.findOneOrFail({
      where: {
        uuid: queueUuid
      },
      relations: ['run']
    });
    queue.state = FileState.PROCESSING;
    await this.queueRepository.save(queue);
    return queue;
  }
}


