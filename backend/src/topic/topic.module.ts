import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Topic from './entities/topic.entity';
import { TopicService } from './topic.service';
import { TopicController } from './topic.controller';
import User from 'src/user/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Topic, User])],
    providers: [TopicService],
    controllers: [TopicController],
    exports: [TopicService],
})
export class TopicModule {}
