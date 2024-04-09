import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import QueueEntity from './entities/queue.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BullModule } from '@nestjs/bull';
import Run from '../run/entities/run.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueEntity, Run]),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'file-queue',
    }),
  ],
  providers: [QueueService],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
