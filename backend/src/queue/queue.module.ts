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

@Module({
    imports: [
        TypeOrmModule.forFeature([QueueEntity, Mission, User, Apikey, Account]),
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
    providers: [QueueService, UserService],
    controllers: [QueueController],
    exports: [QueueService],
})
export class QueueModule {}
