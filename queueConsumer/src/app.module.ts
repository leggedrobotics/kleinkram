import {
    AccessControlModule,
    AccessGroupEntity,
    ApiKeyEntity,
    StorageModule,
} from '@kleinkram/backend-common';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionTriggerEntity } from '@kleinkram/backend-common/entities/action/action-trigger.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
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
import configuration from '@kleinkram/backend-common/typeorm-config';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AccessGroupExpiryProvider } from './accessGroupExpiry/access-group-expiry.provider';
import { ActionsModule } from './actions/actions.module';
import { FileProcessorModule } from './file-processor/file-processor.module';
import { FileCleanupQueueProcessorProvider } from './fileCleanup/file-cleanup-queue-processor.provider';
import { TriggerProcessorModule } from './trigger-processor/trigger-processor.module';

@Module({
    imports: [
        BullModule.forRoot({
            redis,
        }),

        ActionsModule,
        FileProcessorModule,
        TriggerProcessorModule,
        BullModule.registerQueue({
            name: 'file-cleanup',
        }),

        BullModule.registerQueue({
            name: 'move',
        }),

        BullModule.registerQueue({ name: 'file-queue' }),
        BullModule.registerQueue({ name: 'trigger-queue' }),

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
                        ActionRunnerEntity,
                        ActionTemplateEntity,
                        ActionTriggerEntity,
                        UserEntity,
                        ApiKeyEntity,
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
            MissionEntity,
            FileEntity,
            UserEntity,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            GroupMembershipEntity,
        ]),
        ScheduleModule.forRoot(),
        StorageModule,
        AccessControlModule,
    ],
    providers: [FileCleanupQueueProcessorProvider, AccessGroupExpiryProvider],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
