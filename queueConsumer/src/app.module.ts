import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import env from './env';
import configuration from './config';

import { FileProcessor } from './provider';
import QueueEntity from './entities/queue.entity';
import Run from './entities/run.entity';
import FileEntity from './entities/file.entity';
import Topic from './entities/topic.entity';
import Project from './entities/project.entity';


@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'redis',
        port: 6379
      }
    }),
    BullModule.registerQueue({
      name: 'file-queue'
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        ({
          type: 'postgres',
          host: configService.getOrThrow<string>('database.host'),
          port: configService.getOrThrow<number>('database.port'),
          username: configService.getOrThrow<string>('database.username'),
          password: configService.getOrThrow<string>('database.password'),
          database: configService.getOrThrow<string>('database.database'),
          entities: [QueueEntity, Run, FileEntity, Project, Topic],
          synchronize: env.DEV,
          logging: ['warn', 'error']
        }) as PostgresConnectionOptions,
      inject: [ConfigService]
    }),
    TypeOrmModule.forFeature([QueueEntity, Run, FileEntity, Topic])
  ],
  providers: [FileProcessor]
})
export class AppModule {
}

