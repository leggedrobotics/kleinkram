import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import QueueEntity from '@common/entities/queue/queue.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import Mission from '@common/entities/mission/mission.entity';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import Tag from '@common/entities/tag/tag.entity';
import FileEntity from '@common/entities/file/file.entity';
import Worker from '@common/entities/worker/worker.entity';
import Action from '@common/entities/action/action.entity';

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
            Worker,
            Action,
        ]),
    ],
    providers: [QueueService],
    controllers: [QueueController],
    exports: [QueueService],
})
export class QueueModule {}
