import { FileGuardService } from '@/services/file-guard.service';
import { FileLifecycleService } from '@/services/file-lifecycle.service';
import { FileQueryService } from '@/services/file-query.service';
import { FileStorageService } from '@/services/file-storage.service';
import { MetadataService } from '@/services/metadata.service';
import { MissionService } from '@/services/mission.service';
import { TopicService } from '@/services/topic.service';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoxgloveModule } from '../integrations/foxglove.module';
import { QueueModule } from '../queue/queue.module';
import { TriggerModule } from '../trigger/trigger.module';
import { FileController } from './file.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            FileEntity,
            TopicEntity,
            IngestionJobEntity,
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            MetadataEntity,
            TagTypeEntity,
            CategoryEntity,
            FileEventEntity,
            ActionTemplateEntity,
        ]),
        StorageModule,
        FoxgloveModule,
        QueueModule,
        TriggerModule,
        ActionDispatcherModule,
    ],
    providers: [
        FileQueryService,
        FileStorageService,
        FileLifecycleService,
        TopicService,
        MissionService,
        FileGuardService,
        MetadataService,
    ],
    controllers: [FileController],
    exports: [FileQueryService, FileStorageService, FileLifecycleService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FileModule {}
