import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Mission from './entities/mission.entity';
import { MissionService } from './mission.service';
import { MissionController } from './mission.controller';
import Project from '../project/entities/project.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';
import { UserService } from '../user/user.service';
import Account from '../auth/entities/account.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Mission, Project, User, Apikey, Account]),
    ],
    providers: [MissionService, UserService],
    controllers: [MissionController],
    exports: [MissionService],
})
export class MissionModule {}
