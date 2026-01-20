import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { AccountEntity } from '@backend-common/entities/auth/account.entity';
import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { WorkerEntity } from '@backend-common/entities/worker/worker.entity';
import { MissionAccessViewEntity } from '@backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@backend-common/viewEntities/project-access-view.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { ActionDispatcherService } from './action-dispatcher.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ActionEntity,
            ActionTemplateEntity,
            AccessGroupEntity,
            ProjectEntity,
            MissionEntity,
            AccountEntity,
            MetadataEntity,
            WorkerEntity,
            MissionAccessViewEntity,
            ProjectAccessViewEntity,
        ]),
    ],
    providers: [
        ActionDispatcherService,
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
    exports: [ActionDispatcherService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ActionDispatcherModule {}
