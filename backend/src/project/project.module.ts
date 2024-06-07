import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from './entities/project.entity';
import User from '../user/entities/user.entity';
import Apikey from '../auth/entities/apikey.entity';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import Account from '../auth/entities/account.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Project, User, Apikey, Account])],
    providers: [ProjectService, UserService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
export class ProjectModule {}
