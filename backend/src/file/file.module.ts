import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '@common/entities/topic/topic.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';

import { MissionService } from '../mission/mission.service';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { FileGuardService } from '../auth/fileGuard.service';
import { TagService } from '../tag/tag.service';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';

import QueueEntity from '@common/entities/queue/queue.entity';

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
