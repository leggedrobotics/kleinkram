import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Mission from './entities/mission.entity';
import { MissionService } from './mission.service';
import { MissionController } from './mission.controller';
import Project from '../project/entities/project.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Mission, Project, User, Apikey])],
    providers: [MissionService],
    controllers: [MissionController],
    exports: [MissionService],
})
export class MissionModule {}
