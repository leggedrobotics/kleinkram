import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Processor, Process, OnQueueActive } from '@nestjs/bull';
import { Job } from 'bull';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'file-queue',
    }),
  ],
})
export class AppModule {}

@Processor('file-queue')
class FileProcessor {
  @OnQueueActive()
  onActive(job: Job) {
    console.log(`Processing job ${job.id} of type ${job.name}.`);
  }

  @Process()
  handleFileProcessing(job: Job<unknown>) {
    console.log(`Processing job ${job.id}:`, job.data);
    // Here, implement your file processing logic.
  }
}
