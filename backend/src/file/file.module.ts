import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '@common/entities/topic/topic.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { MissionService } from '../mission/mission.service';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ProjectGuardService } from '../auth/projectGuard.service';
import { FileGuardService } from '../auth/fileGuard.service';
import { TagService } from '../tag/tag.service';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import { BullModule } from '@nestjs/bull';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Mission,
            FileEntity,
            Topic,
            QueueEntity,
            Project,
            User,
            Apikey,
            Account,
            AccessGroup,
            Tag,
            TagType,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
        ]),
        BullModule.registerQueue({
            name: 'file-cleanup',
        }),
    ],
    providers: [
        FileService,
        TopicService,
        MissionService,
        UserService,
        MissionGuardService,
        ProjectGuardService,
        FileGuardService,
        TagService,
    ],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
