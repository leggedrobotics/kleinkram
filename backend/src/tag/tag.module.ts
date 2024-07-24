import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Tag from '@common/entities/tag/tag.entity';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import TagType from '@common/entities/tagType/tagType.entity';
import Mission from '@common/entities/mission/mission.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import { ProjectGuardService } from '../auth/projectGuard.service';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import Apikey from '@common/entities/auth/apikey.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Tag,
            TagType,
            Mission,
            User,
            AccessGroup,
            Project,
            Account,
            Apikey,
        ]),
    ],
    providers: [
        TagService,
        MissionGuardService,
        ProjectGuardService,
        UserService,
    ],
    controllers: [TagController],
    exports: [TagService],
})
export class TagModule {}
