import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import File from './entities/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '../topic/entities/topic.entity';
import Run from '../run/entities/run.entity';
import Project from '../project/entities/project.entity';
import User from '../user/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Run, File, Topic, Project, User])],
    providers: [FileService, TopicService],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
