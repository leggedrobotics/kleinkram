import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import File from './entities/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '../topic/entities/topic.entity';
import Mission from '../mission/entities/mission.entity';
import Project from '../project/entities/project.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';
import { MissionService } from '../mission/mission.service';
import { UserService } from '../user/user.service';
import Account from '../auth/entities/account.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import AccessGroup from '../auth/entities/accessgroup.entity';
import { ProjectGuardService } from '../auth/projectGuard.service';
import { FileGuardService } from '../auth/fileGuard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Mission,
            File,
            Topic,
            Project,
            User,
            Apikey,
            Account,
            AccessGroup,
        ]),
    ],
    providers: [
        FileService,
        TopicService,
        MissionService,
        UserService,
        MissionGuardService,
        ProjectGuardService,
        FileGuardService,
    ],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
