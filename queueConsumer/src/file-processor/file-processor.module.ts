import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { FileIngestionService } from './file-ingestion.service';
import { FILE_HANDLER, FileHandler } from './handlers/file-handler.interface';
import { McapHandler } from './handlers/mcap.handler';
import { GoogleDriveStrategy } from './strategies/google-drive.strategy';
import { S3Strategy } from './strategies/s3.strategy';

import { ApiKeyEntity } from '@kleinkram/backend-common';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { FileQueueProcessorProvider } from './file-queue-processor.provider';
import { FileRepairProcessor } from './file-repair.consumer';
import { RosBagHandler } from './handlers/bag.hander';
import { METRIC_PROVIDERS } from './handlers/file-processor.metrics';
import { McapMetadataService } from './handlers/mcap-metadata.service';
import { RosBagMetadataService } from './handlers/rosbag-metadata.service';

import { Db3MetadataService } from './handlers/db3-metadata.service';
import { Db3Handler } from './handlers/db3.handler';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            FileEntity,
            IngestionJobEntity,
            TopicEntity,
            ActionEntity,
            ActionTemplateEntity,
            FileEventEntity,
            WorkerEntity,
            ApiKeyEntity,
        ]),
        BullModule.registerQueue({ name: 'file-queue' }),
        StorageModule,
        ActionDispatcherModule,
    ],
    providers: [
        FileQueueProcessorProvider,
        FileRepairProcessor,
        FileIngestionService,
        GoogleDriveStrategy,
        S3Strategy,

        RosBagMetadataService,
        McapMetadataService,
        Db3MetadataService,
        McapHandler,
        RosBagHandler,
        Db3Handler,

        ...METRIC_PROVIDERS,

        {
            provide: FILE_HANDLER,
            useFactory: (
                bag: RosBagHandler,
                mcap: McapHandler,
                db3: Db3Handler,
            ): FileHandler[] => [bag, mcap, db3],
            inject: [McapHandler, RosBagHandler, Db3Handler],
        },
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FileProcessorModule {}
