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
import { downloadFile } from './helper/driveHelper';
import { uploadFile } from './helper/minioHelper';
import Topic from './entities/topic.entity';
import { FileState } from './enum';

const fs = require('fs').promises;


async function processFile(fileId: string, fileName: string){
  const buffer = await downloadFile(fileId);

  const tempFilePath = `/tmp/tempfile-${Date.now()}.bag`;
  await fs.writeFile(tempFilePath, buffer);
  const mcapPath = tempFilePath.replace('.bag', '.mcap');

  const convertedBuffer = await convert(tempFilePath, mcapPath);

  // Read converted file and upload
  await uploadFile(env.MINIO_BAG_BUCKET_NAME, fileName, convertedBuffer)

  const res = await mcapMetaInfo(convertedBuffer);

  // Optionally, clean up temporary files
  await fs.unlink(tempFilePath);
  await fs.unlink(mcapPath);
  return res;
}


@Processor('file-queue')
@Injectable()
export class FileProcessor implements OnModuleInit {
  constructor(
    @InjectQueue('file-queue') private readonly fileQueue: Queue,
    @InjectRepository(QueueEntity) private queueRepository: Repository<QueueEntity>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(FileEntity) private fileRepository: Repository<FileEntity>,
    @InjectRepository(Topic) private topicRepository: Repository<Topic>,
    ) {}

  async onModuleInit() {
    console.log('Connecting to Redis...')
    try {
      await this.fileQueue.isReady();
      console.log('Connected to Redis successfully!');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    console.log(`Processing job ${job.id} of type ${job.name}.`);
  }

  @Process('processDriveFile')
  async handleFileProcessing(job: Job<{uuid: string}>) {
    console.log(`Processing job ${job.id}:`, job.data);
    const queue = await this.queueRepository.findOneOrFail({
      where: {
        uuid: job.data.uuid
      },
      relations: ['run'] })
    queue.state = FileState.PROCESSING
    await this.queueRepository.save(queue);
    try {

      const { topics, date, size } = await processFile(queue.identifier, queue.name);

      const res = topics.map(async (topic) => {
        const newTopic = this.topicRepository.create(topic)
        await this.topicRepository.save(newTopic);

        return this.topicRepository.findOne({ where: { uuid: newTopic.uuid } });
      })
      const createdTopics = await Promise.all(res);

      const newFile = this.fileRepository.create({
        identifier: queue.identifier,
        date,
        topics: createdTopics,
        run: queue.run,
        size,
        filename: queue.name
      })
      const savedFile = await this.fileRepository.save(newFile);
      queue.state = FileState.DONE
      await this.queueRepository.save(queue);
      return savedFile;
    }
    catch (error) {
      queue.state = FileState.ERROR
      await this.queueRepository.save(queue);
      throw error;
    }
  }
}


