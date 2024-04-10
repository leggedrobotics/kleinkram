import { BullModule, InjectQueue } from '@nestjs/bull';
import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Processor, Process, OnQueueActive } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { FileProcessor } from './provider';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: "redis",
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'file-queue',
    }),
  ],
  providers: [FileProcessor],
})
export class AppModule {}

