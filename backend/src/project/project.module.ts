import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from './entities/project.entity';
import User from '../user/entities/user.entity';
import Token from '../auth/entities/token.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Project, User, Token])],
    providers: [ProjectService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
export class ProjectModule {}
