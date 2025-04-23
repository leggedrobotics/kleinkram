import ActionTemplate from '@common/entities/action/action-template.entity';
import Action from '@common/entities/action/action.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import Tag from '@common/entities/tag/tag.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionService } from '../../services/action.service';
import { ActionGuardService } from '../auth/action-guard.service';
import { QueueModule } from '../queue/queue.module';
import { ActionController } from './action.controller';

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
