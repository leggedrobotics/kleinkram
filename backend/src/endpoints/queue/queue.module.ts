import QueueService from '@/services/queue.service';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';

@Module({
    imports: [
        StorageModule,
        TypeOrmModule.forFeature([
            IngestionJobEntity,
            FileEventEntity,
            MissionEntity,
            AccountEntity,
            AccessGroupEntity,
            ProjectEntity,
            MetadataEntity,
            FileEntity,
            WorkerEntity,
            ActionEntity,
        ]),
    ],
    providers: [
        QueueService,
        makeGaugeProvider({
            name: 'backend_online_workers',
            help: 'Number of online workers',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_pending_jobs',
            help: 'Number of pending jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_active_jobs',
            help: 'Number of active jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_completed_jobs',
            help: 'Number of completed jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_failed_jobs',
            help: 'Number of completed jobs',
            labelNames: ['queue'],
        }),
    ],
    controllers: [],
    exports: [QueueService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class QueueModule {}
