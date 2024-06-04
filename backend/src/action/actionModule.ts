import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Action from './entities/action.entity';
import { QueueModule } from '../queue/queue.module';
import Apikey from '../auth/entities/apikey.entity';
import User from '../user/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Action, Apikey, User]), QueueModule],
    providers: [ActionService],
    exports: [ActionService],
    controllers: [ActionController],
})
export class ActionModule {}
