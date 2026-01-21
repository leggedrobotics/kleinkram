import { AccessControlModule, StorageModule } from '@kleinkram/backend-common';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionTriggerEntity } from '@kleinkram/backend-common/entities/action/action-trigger.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { ApiKeyEntity } from '@kleinkram/backend-common/entities/auth/api-key.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import os from 'node:os';
import { ActionQueueProcessorProvider } from './action-queue-processor.provider';
import { ActionErrorHintService } from './services/action-error-hint.service';
import { ActionManagerService } from './services/action-manager.service';
import { ArtifactService } from './services/artifact.service';
import { ContainerCleanupService } from './services/cleanup-containers.service';
import { ContainerLifecycleService } from './services/container-lifecycle.service';
import { ContainerStatsService } from './services/container-stats.service';
import { DockerDaemon } from './services/docker-daemon.service';
import { ImageResolutionService } from './services/image-resolution.service';
import { LogIngestionService } from './services/log-ingestion.service';
import { ResourceMonitorService } from './services/resource-monitor.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: `action-queue-${os.hostname()}`,
        }),
        TypeOrmModule.forFeature([
            ActionEntity,
            ApiKeyEntity,
            ActionRunnerEntity,
            WorkerEntity,
            ActionTemplateEntity,
            ActionTriggerEntity,
        ]),
        AccessControlModule,
        StorageModule,
    ],
    providers: [
        ActionQueueProcessorProvider,
        DockerDaemon,
        ImageResolutionService,
        ResourceMonitorService,
        LogIngestionService,
        ArtifactService,
        ContainerLifecycleService,
        ActionManagerService,
        ContainerCleanupService,
        ActionErrorHintService,
        ContainerStatsService,
    ],
    exports: [ActionManagerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ActionsModule {}
