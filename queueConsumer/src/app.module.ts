import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import configuration from '@common/typeorm-config';
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
import TagType from '@common/entities/tagType/tag-type.entity';
import Tag from '@common/entities/tag/tag.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import MissionAccess from '@common/entities/auth/mission-access.entity';
import { FileQueueProcessorProvider } from './files/file-queue-processor.provider';
import { ActionQueueProcessorProvider } from './actions/action-queue-processor.provider';
import { DockerDaemon } from './actions/services/docker-daemon.service';
import { ContainerCleanupService } from './actions/services/cleanup-containers.service';
import { ActionManagerService } from './actions/services/action-manager.service';
import { ScheduleModule } from '@nestjs/schedule';
import { FileCleanupQueueProcessorProvider } from './fileCleanup/file-cleanup-queue-processor.provider';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import ActionTemplate from '@common/entities/action/action-template.entity';
import Worker from '@common/entities/worker/worker.entity';
import os from 'node:os';
import CategoryEntity from '@common/entities/category/category.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import { AccessGroupExpiryProvider } from './accessGroupExpiry/access-group-expiry.provider';

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
                        CategoryEntity,
                        GroupMembership,
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
            CategoryEntity,
            GroupMembership,
        ]),
        ScheduleModule.forRoot(),
    ],
    providers: [
        FileQueueProcessorProvider,
        ActionQueueProcessorProvider,
        FileCleanupQueueProcessorProvider,
        DockerDaemon,
        ActionManagerService,
        ContainerCleanupService,
        AccessGroupExpiryProvider,
    ],
})
export class AppModule {}
