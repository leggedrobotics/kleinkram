import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import configuration from '@common/typeorm_config';
import Mission from '@common/entities/mission/mission.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import FileEntity from '@common/entities/file/file.entity';
import Project from '@common/entities/project/project.entity';
import Topic from '@common/entities/topic/topic.entity';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { FileProcessor } from './files/provider';
import { ActionQueueProcessor } from './actions/action_queue_processor';
import env from '@common/env';
import TagType from '@common/entities/tagType/tagType.entity';
import Tag from '@common/entities/tag/tag.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import MissionAccess from '@common/entities/auth/mission_access.entity';
import { DockerDaemon } from './actions/docker_daemon';
import { ContainerScheduler } from './actions/container_scheduler';

@Module({
    imports: [
        BullModule.forRoot({
            redis: {
                host: 'redis',
                port: 6379,
            },
        }),

        BullModule.registerQueue({
            name: 'file-queue',
        }),

        BullModule.registerQueue({
            name: 'action-queue',
        }),

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
                    username:
                        configService.getOrThrow<string>('database.username'),
                    password:
                        configService.getOrThrow<string>('database.password'),
                    database:
                        configService.getOrThrow<string>('database.database'),
                    entities: [
                        QueueEntity,
                        Mission,
                        FileEntity,
                        Project,
                        Topic,
                        Action,
                        Project,
                        User,
                        Apikey,
                        Account,
                        AccessGroup,
                        TagType,
                        Tag,
                        ProjectAccess,
                        MissionAccess,
                    ],
                    synchronize: env.DEV,
                    logging: ['warn', 'error'],
                }) as PostgresConnectionOptions,
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
            QueueEntity,
            Mission,
            FileEntity,
            Topic,
            Action,
            Project,
            User,
            Apikey,
            TagType,
            Tag,
            ProjectAccess,
            MissionAccess,
        ]),
    ],
    providers: [
        FileProcessor,
        ActionQueueProcessor,
        DockerDaemon,
        ContainerScheduler,
    ],
})
export class AppModule {}
