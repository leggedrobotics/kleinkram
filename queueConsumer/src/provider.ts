import { InjectQueue, OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';

@Processor('file-queue')
@Injectable()
export class FileProcessor implements OnModuleInit {
  constructor(@InjectQueue('file-queue') private readonly fileQueue: Queue) {}

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
  handleFileProcessing(job: Job<unknown>) {
    console.log(`Processing job ${job.id}:`, job.data);
    // Your processing logic here
  }
}
