import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import File from './entities/file.entity';
import { TopicService } from '../topic/topic.service';
import Topic from '../topic/entities/topic.entity';
import Mission from '../mission/entities/mission.entity';
import Project from '../project/entities/project.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Mission, File, Topic, Project, User, Apikey]),
    ],
    providers: [FileService, TopicService],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
