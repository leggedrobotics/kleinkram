import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionService } from '../../services/mission.service';
import { TagService } from '../../services/tag.service';
import { UserService } from '../../services/user.service';
import { MissionController } from './mission.controller';

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
