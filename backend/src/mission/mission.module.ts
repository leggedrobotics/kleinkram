import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Mission from '@common/entities/mission/mission.entity';
import { MissionService } from './mission.service';
import { MissionController } from './mission.controller';
import Project from '@common/entities/project/project.entity';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import { ProjectGuardService } from '../auth/projectGuard.service';
import AccessGroup from '@common/entities/auth/accessgroup.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Mission,
            Project,
            User,
            Apikey,
            Account,
            AccessGroup,
        ]),
    ],
    providers: [
        MissionService,
        UserService,
        MissionGuardService,
        ProjectGuardService,
    ],
    controllers: [MissionController],
    exports: [MissionService],
})
export class MissionModule {
}
