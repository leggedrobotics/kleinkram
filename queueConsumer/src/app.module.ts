import { redis } from '@kleinkram/backend-common/consts';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { ApikeyEntity } from '@kleinkram/backend-common/entities/auth/apikey.entity';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { MissionAccessEntity } from '@kleinkram/backend-common/entities/auth/mission-access.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import env from '@kleinkram/backend-common/environment';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import configuration from '@kleinkram/backend-common/typeorm-config';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import os from 'node:os';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AccessGroupExpiryProvider } from './accessGroupExpiry/access-group-expiry.provider';
import { ActionQueueProcessorProvider } from './actions/action-queue-processor.provider';
import { ActionManagerService } from './actions/services/action-manager.service';
import { ContainerCleanupService } from './actions/services/cleanup-containers.service';
import { DockerDaemon } from './actions/services/docker-daemon.service';
import { ImageResolutionService } from './actions/services/image-resolution.service';
import { FileProcessorModule } from './file-processor/file-processor.module';
import { FileCleanupQueueProcessorProvider } from './fileCleanup/file-cleanup-queue-processor.provider';

@Module({
    imports: [
        BullModule.forRoot({
            redis,
        }),

        FileProcessorModule,

        BullModule.registerQueue({
            name: `action-queue-${os.hostname()}`,
        }),
        BullModule.registerQueue({
            name: 'file-cleanup',
        }),

        BullModule.registerQueue({
            name: 'move',
        }),

        BullModule.registerQueue({ name: 'file-queue' }),

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
                        IngestionJobEntity,
                        FileEventEntity,
                        MissionEntity,
                        FileEntity,
                        ProjectEntity,
                        TopicEntity,
                        ActionEntity,
                        ActionTemplateEntity,
                        ProjectEntity,
                        UserEntity,
                        ApikeyEntity,
                        AccountEntity,
                        AccessGroupEntity,
                        TagTypeEntity,
                        MetadataEntity,
                        ProjectAccessEntity,
                        MissionAccessEntity,
                        ProjectAccessViewEntity,
                        MissionAccessViewEntity,
                        WorkerEntity,
                        CategoryEntity,
                        GroupMembershipEntity,
                    ],
                    synchronize: env.DEV,
                    logging: ['warn', 'error'],
                }) as PostgresConnectionOptions,
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
            IngestionJobEntity,
            FileEventEntity,
            MissionEntity,
            FileEntity,
            TopicEntity,
            ActionEntity,
            ActionTemplateEntity,
            ProjectEntity,
            UserEntity,
            ApikeyEntity,
            TagTypeEntity,
            MetadataEntity,
            ProjectAccessEntity,
            MissionAccessEntity,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            WorkerEntity,
            CategoryEntity,
            GroupMembershipEntity,
        ]),
        ScheduleModule.forRoot(),
        StorageModule,
    ],
    providers: [
        ActionQueueProcessorProvider,
        FileCleanupQueueProcessorProvider,
        DockerDaemon,
        ActionManagerService,
        ContainerCleanupService,
        AccessGroupExpiryProvider,
        ImageResolutionService,
    ],
})
export class AppModule {}
