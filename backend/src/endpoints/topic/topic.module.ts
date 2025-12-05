import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicService } from '../../services/topic.service';
import { TopicController } from './topic.controller';

@Module({
    imports: [TypeOrmModule.forFeature([TopicEntity])],
    providers: [TopicService],
    controllers: [TopicController],
    exports: [TopicService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TopicModule {}
