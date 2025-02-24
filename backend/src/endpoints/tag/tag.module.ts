import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Tag from '@common/entities/tag/tag.entity';
import { TagService } from '../../services/tag.service';
import { TagController } from './tag.controller';
import TagType from '@common/entities/tagType/tag-type.entity';
import Mission from '@common/entities/mission/mission.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import Account from '@common/entities/auth/account.entity';
import Apikey from '@common/entities/auth/apikey.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Tag,
            TagType,
            Mission,
            AccessGroup,
            Project,
            Account,
            Apikey,
        ]),
    ],
    providers: [TagService],
    controllers: [TagController],
    exports: [TagService],
})
export class TagModule {}
