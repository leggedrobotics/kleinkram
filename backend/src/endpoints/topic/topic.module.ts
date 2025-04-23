import Topic from '@common/entities/topic/topic.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicService } from '../../services/topic.service';
import { TopicController } from './topic.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Topic])],
    providers: [TopicService],
    controllers: [TopicController],
    exports: [TopicService],
})
export class TopicModule {}
