import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import QueueEntity from './entities/queue.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BullModule } from '@nestjs/bull';
import Mission from '../mission/entities/mission.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';
import { UserService } from '../user/user.service';
import Account from '../auth/entities/account.entity';
import { MissionService } from '../mission/mission.service';
import AccessGroup from '../auth/entities/accessgroup.entity';
import Project from '../project/entities/project.entity';
import { MissionGuardService } from '../auth/missionGuard.service';
import { ProjectGuardService } from '../auth/projectGuard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            QueueEntity,
            Mission,
            User,
            Apikey,
            Account,
            AccessGroup,
            Project,
        ]),
        BullModule.forRoot({
            redis: {
                host: 'redis',
                port: 6379,
            },
        }),
        BullModule.registerQueue({
            name: 'file-queue',
        }),
        BullModule.registerQueue({
            name: 'action-queue',
        }),
    ],
    providers: [
        QueueService,
        UserService,
        MissionGuardService,
        ProjectGuardService,
    ],
    controllers: [QueueController],
    exports: [QueueService],
})
export class QueueModule {}
