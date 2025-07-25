import Action from '@common/entities/action/action.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import FileEntity from '@common/entities/file/file.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import Tag from '@common/entities/tag/tag.entity';
import Worker from '@common/entities/worker/worker.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { QueueService } from '../../services/queue.service';
import { QueueController } from './queue.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            QueueEntity,
            Mission,
            Account,
            AccessGroup,
            Project,
            Tag,
            FileEntity,
            Worker,
            Action,
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
    controllers: [QueueController],
    exports: [QueueService],
})
export class QueueModule {}
