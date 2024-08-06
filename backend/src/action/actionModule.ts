import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Action from '@common/entities/action/action.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import Account from '@common/entities/auth/account.entity';
import { QueueModule } from '../queue/queue.module';
import { ActionGuardService } from '../auth/actionGuard.service';
import { ProjectGuardService } from '../auth/projectGuard.service';
import { MissionGuardService } from '../auth/missionGuard.service';
import { UserService } from '../user/user.service';
import Tag from '@common/entities/tag/tag.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Action,
            Apikey,
            User,
            AccessGroup,
            Project,
            Mission,
            Account,
            Tag,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
        ]),
        QueueModule,
    ],
    providers: [
        ActionService,
        ActionGuardService,
        ProjectGuardService,
        MissionGuardService,
        UserService,
    ],
    exports: [ActionService],
    controllers: [ActionController],
})
export class ActionModule {}
