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
import env from '@common/env';
import TagType from '@common/entities/tagType/tagType.entity';
import Tag from '@common/entities/tag/tag.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import MissionAccess from '@common/entities/auth/mission_access.entity';
import { FileQueueProcessorProvider } from './files/fileQueueProcessor.provider';
import { ActionQueueProcessorProvider } from './actions/actionQueueProcessor.provider';
import { DockerDaemon } from './actions/services/dockerDaemon.service';
import { ContainerCleanupService } from './actions/services/cleanupContainers.service';
import { ActionManagerService } from './actions/services/actionManager.service';
import { ScheduleModule } from '@nestjs/schedule';
import { FileCleanupQueueProcessorProvider } from './fileCleanup/fileCleanupQueueProcessor.provider';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import ActionTemplate from '@common/entities/action/actionTemplate.entity';
import Worker from '@common/entities/worker/worker.entity';
import os from 'node:os';
import { MoveMissionProvider } from './moveMission/moveMission.provider';

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
            name: `action-queue-${os.hostname()}`,
        }),
        BullModule.registerQueue({
            name: 'file-cleanup',
        }),

        BullModule.registerQueue({
            name: 'move',
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
                        ActionTemplate,
                        Project,
                        User,
                        Apikey,
                        Account,
                        AccessGroup,
                        TagType,
                        Tag,
                        ProjectAccess,
                        MissionAccess,
                        ProjectAccessViewEntity,
                        MissionAccessViewEntity,
                        Worker,
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
            ActionTemplate,
            Project,
            User,
            Apikey,
            TagType,
            Tag,
            ProjectAccess,
            MissionAccess,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            Worker,
        ]),
        ScheduleModule.forRoot(),
    ],
    providers: [
        FileQueueProcessorProvider,
        ActionQueueProcessorProvider,
        FileCleanupQueueProcessorProvider,
        MoveMissionProvider,
        DockerDaemon,
        ActionManagerService,
        ContainerCleanupService,
    ],
})
export class AppModule {}
