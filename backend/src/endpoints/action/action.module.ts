import ActionTemplateEntity from '@kleinkram/backend-common/entities/action/action-template.entity';
import ActionEntity from '@kleinkram/backend-common/entities/action/action.entity';
import AccessGroupEntity from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import AccountEntity from '@kleinkram/backend-common/entities/auth/account.entity';
import MetadataEntity from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import MissionEntity from '@kleinkram/backend-common/entities/mission/mission.entity';
import ProjectEntity from '@kleinkram/backend-common/entities/project/project.entity';
import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionService } from '../../services/action.service';
import { ActionGuardService } from '../auth/action-guard.service';
import { FileModule } from '../file/file.module';
import { QueueModule } from '../queue/queue.module';
import { ActionsController } from './action.controller';

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
        ]),
        QueueModule,
        StorageModule,
        StorageModule,
        ActionDispatcherModule,
        FileModule,
    ],
    providers: [ActionService, ActionGuardService],
    exports: [ActionService],
    controllers: [ActionsController],
})
export class ActionModule {}
