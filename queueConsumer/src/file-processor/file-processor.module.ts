import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActionDispatcherService } from '@common/modules/action-dispatcher/action-dispatcher.service';
import { FileIngestionService } from './file-ingestion.service';
import { FILE_HANDLER, FileHandler } from './handlers/file-handler.interface';
import { McapHandler } from './handlers/mcap.handler';
import { GoogleDriveStrategy } from './strategies/google-drive.strategy';
import { MinioStrategy } from './strategies/minio.strategy';

import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import WorkerEntity from '@common/entities/worker/worker.entity';
import { StorageModule } from '@common/modules/storage/storage.module';
import { FileQueueProcessorProvider } from './file-queue-processor.provider';
import { FileRepairProcessor } from './file-repair.consumer';
import { RosBagHandler } from './handlers/bag.hander';
import { METRIC_PROVIDERS } from './handlers/file-processor.metrics';
import { McapMetadataService } from './handlers/mcap-metadata.service';
import { RosBagMetadataService } from './handlers/rosbag-metadata.service';

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
            ApikeyEntity,
        ]),
        BullModule.registerQueue({ name: 'file-queue' }),
        StorageModule,
    ],
    providers: [
        FileQueueProcessorProvider,
        FileRepairProcessor,
        FileIngestionService,
        GoogleDriveStrategy,
        MinioStrategy,
        ActionDispatcherService,

        RosBagMetadataService,
        McapMetadataService,
        McapHandler,
        RosBagHandler,

        ...METRIC_PROVIDERS,

        {
            provide: FILE_HANDLER,
            useFactory: (
                bag: RosBagHandler,
                mcap: McapHandler,
            ): FileHandler[] => [bag, mcap],
            inject: [McapHandler, RosBagHandler],
        },
    ],
})
export class FileProcessorModule {}
