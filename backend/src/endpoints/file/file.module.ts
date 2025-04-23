import FileEntity from '@common/entities/file/file.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import Topic from '@common/entities/topic/topic.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileService } from '../../services/file.service';
import { TopicService } from '../../services/topic.service';
import { FileController } from './file.controller';

import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import { MissionService } from '../../services/mission.service';
import { TagService } from '../../services/tag.service';

import Category from '@common/entities/category/category.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import { FileGuardService } from '../../services/file-guard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Mission,
            FileEntity,
            Topic,
            QueueEntity,
            Project,
            Account,
            AccessGroup,
            Tag,
            TagType,
            Category,
        ]),
    ],
    providers: [
        FileService,
        TopicService,
        MissionService,
        FileGuardService,
        TagService,
    ],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
