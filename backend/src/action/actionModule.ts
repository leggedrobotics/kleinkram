import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Action from './entities/action.entity';
import { QueueModule } from '../queue/queue.module';
import Apikey from '../auth/entities/apikey.entity';
import User from '../user/entities/user.entity';
import { ActionGuardService } from '../auth/actionGuard.service';
import AccessGroup from '../auth/entities/accessgroup.entity';
import { ProjectGuardService } from '../auth/projectGuard.service';
import Project from '../project/entities/project.entity';
import Mission from '../mission/entities/mission.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import { UserService } from '../user/user.service';
import Account from '../auth/entities/account.entity';

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
