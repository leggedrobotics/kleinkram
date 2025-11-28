import { ActionDispatcherService } from '@common/modules/action-dispatcher/action-dispatcher.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import ActionTemplateEntity from '../../entities/action/action-template.entity';
import ActionEntity from '../../entities/action/action.entity';
import AccessGroupEntity from '../../entities/auth/accessgroup.entity';
import AccountEntity from '../../entities/auth/account.entity';
import MetadataEntity from '../../entities/metadata/metadata.entity';
import MissionEntity from '../../entities/mission/mission.entity';
import ProjectEntity from '../../entities/project/project.entity';
import WorkerEntity from '../../entities/worker/worker.entity';

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
export class ActionDispatcherModule {}
