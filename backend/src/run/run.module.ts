import { Module } from '@nestjs/common';
import { RunService } from './run.service';
import { RunController } from './run.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from '../project/entities/project.entity';
import Run from './entities/run.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '../topic/entities/topic.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Run, Topic])],
  providers: [RunService, TopicService],
  controllers: [RunController],
  exports: [RunService],
})
export class RunModule {}
