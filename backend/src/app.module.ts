import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunModule } from './run/run.module';
import { ProjectController } from './project/project.controller';
import { ProjectModule } from './project/project.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import env from './env';
import configuration from './config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { TopicModule } from './topic/topic.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
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
          entities: [configService.getOrThrow<string>('entities')],
          synchronize: env.DEV,
          logging: ['warn', 'error'],
        }) as PostgresConnectionOptions,
      inject: [ConfigService],
    }),
    RunModule,
    ProjectModule,
    TopicModule,
  ],
  controllers: [ProjectController],
})
export class AppModule {}
