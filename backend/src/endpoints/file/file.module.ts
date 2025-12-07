import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
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
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileGuardService } from '../../services/file-guard.service';
import { FileService } from '../../services/file.service';
import { MissionService } from '../../services/mission.service';
import { TagService } from '../../services/tag.service';
import { TopicService } from '../../services/topic.service';
import { FoxgloveModule } from '../integrations/foxglove.module';
import { QueueModule } from '../queue/queue.module';
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
        ]),
        StorageModule,
        FoxgloveModule,
        QueueModule,
    ],
    providers: [
        FileService,
        TopicService,
        MissionService,
        FileGuardService,
        TagService,
    ],
    controllers: [FileController],
    exports: [FileService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FileModule {}
