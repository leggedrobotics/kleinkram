import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from '@common/entities/project/project.entity';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { UserService } from '../user/user.service';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ProjectGuardService } from '../auth/projectGuard.service';
import TagType from '@common/entities/tagType/tagType.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Project,
            User,
            Apikey,
            Account,
            AccessGroup,
            TagType,
        ]),
    ],
    providers: [ProjectService, UserService, ProjectGuardService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
export class ProjectModule {}
