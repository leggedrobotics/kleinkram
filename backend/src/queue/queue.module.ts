import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import QueueEntity from '@common/entities/queue/queue.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BullModule } from '@nestjs/bull';
import Mission from '@common/entities/mission/mission.entity';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import { ProjectGuardService } from '../auth/projectGuard.service';
import Tag from '@common/entities/tag/tag.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import FileEntity from '@common/entities/file/file.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            QueueEntity,
            Mission,
            Account,
            AccessGroup,
            Project,
            Tag,
            FileEntity,
        ]),
        BullModule.registerQueue({
            name: 'file-queue',
        }),
        BullModule.registerQueue({
            name: 'action-queue',
        }),
    ],
    providers: [QueueService],
    controllers: [QueueController],
    exports: [QueueService],
})
export class QueueModule {}
