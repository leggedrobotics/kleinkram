import { InjectQueue, OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, JobId, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import QueueEntity from './entities/queue.entity';
import Run from './entities/run.entity';
import FileEntity from './entities/file.entity';
import env from './env';
import { convert, mcapMetaInfo } from './helper/converter';
import { downloadFile, getMetadata, listFiles } from './helper/driveHelper';
import { uploadFile } from './helper/minioHelper';
import Topic from './entities/topic.entity';
import { FileLocation, FileState } from './enum';

const fs = require('fs').promises;

async function processFile(fileId: string, fileName: string, jobId: JobId) {
  console.log(`Job {${jobId}}: Downloading file...`)
  const buffer = await downloadFile(fileId);
  console.log(`Job {${jobId}}: Writing file...`)

  const tempFilePath = `/tmp/tempfile-${Date.now()}.bag`;
  await fs.writeFile(tempFilePath, buffer);
  const mcapPath = tempFilePath.replace('.bag', '.mcap');
  console.log(`Job {${jobId}}: Converting file...`)

  const convertedBuffer = await convert(tempFilePath, mcapPath);
  const newFileName = fileName.replace('.bag', '.mcap');

  console.log(`Job {${jobId}}: Uploading file ${newFileName}...`)

  // Read converted file and upload
  await uploadFile(env.MINIO_BAG_BUCKET_NAME, newFileName, convertedBuffer)
  console.log(`Job {${jobId}}: Metadata reading...`)

  const res = await mcapMetaInfo(convertedBuffer);
  console.log(`Job {${jobId}}: Cleanup...`)

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
  async handleFileProcessing(job: Job<{queueUuid: string}>) {
    console.log(`Job ${job.id} started, uuid is ${job.data.queueUuid}`);
    const queue = await this.queueRepository.findOneOrFail({
      where: {
        uuid: job.data.queueUuid
      },
      relations: ['run'] })
    console.log(`Job {${job.id}}, file identifier is ${queue.identifier}`)
    queue.state = FileState.PROCESSING
    await this.queueRepository.save(queue);
    const metadataRes = await getMetadata(queue.identifier);
    console.log(metadataRes)
    if(metadataRes.mimeType !== 'application/vnd.google-apps.folder') {
      console.log(`Job {${job.id}} is a file, processing...`)
      try {

        const { topics, date, size } = await processFile(queue.identifier, metadataRes.name, job.id);

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
          filename: metadataRes.name
        })
        const savedFile = await this.fileRepository.save(newFile);
        queue.state = FileState.DONE
        await this.queueRepository.save(queue);
        return savedFile;
      } catch (error) {
        queue.state = FileState.ERROR
        await this.queueRepository.save(queue);
        throw error;
      }
    }
    else {
      console.log(`Job {${job.id}} is a folder, processing...`)

      const files = await listFiles(queue.identifier)
      await Promise.all(files.map(async (file) => {
        if(file.name.endsWith('.bag')){
          const newQueue = this.queueRepository.create({
            identifier: file.id,
            state: FileState.PENDING,
            location: FileLocation.DRIVE,
            run: queue.run
          })
          await this.queueRepository.save(newQueue);

          await this.fileQueue.add('processDriveFile', {
            queueUuid: newQueue.uuid,
          })
        }

      }))
      queue.state = FileState.DONE
      await this.queueRepository.save(queue);
    }
  }
}


