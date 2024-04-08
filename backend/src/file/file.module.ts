import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from '../project/entities/project.entity';
import File from './entities/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '../topic/entities/topic.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, File, Topic])],
  providers: [FileService, TopicService],
  controllers: [FileController],
  exports: [FileService],
})
export class FileModule {}
