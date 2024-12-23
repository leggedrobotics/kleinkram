import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from '../../services/action.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Action from '@common/entities/action/action.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import Account from '@common/entities/auth/account.entity';
import { QueueModule } from '../queue/queue.module';
import Tag from '@common/entities/tag/tag.entity';
import ActionTemplate from '@common/entities/action/action-template.entity';
import { ActionGuardService } from '../auth/action-guard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Action,
            ActionTemplate,
            AccessGroup,
            Project,
            Mission,
            Account,
            Tag,
        ]),
        QueueModule,
    ],
    providers: [ActionService, ActionGuardService],
    exports: [ActionService],
    controllers: [ActionController],
})
export class ActionModule {}
