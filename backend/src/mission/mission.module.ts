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
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
import { TagService } from '../tag/tag.service';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Mission,
            Project,
            Account,
            AccessGroup,
            Tag,
            TagType,
        ]),
    ],
    providers: [MissionService, UserService, TagService],
    controllers: [MissionController],
    exports: [MissionService],
})
export class MissionModule {}
