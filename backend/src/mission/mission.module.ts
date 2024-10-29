import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Mission from '@common/entities/mission/mission.entity';
import { MissionService } from './mission.service';
import { MissionController } from './mission.controller';
import Project from '@common/entities/project/project.entity';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
import { TagService } from '../tag/tag.service';

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
