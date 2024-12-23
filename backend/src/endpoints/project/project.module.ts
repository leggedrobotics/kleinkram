import { Module } from '@nestjs/common';
import { ProjectService } from '../../services/project.service';
import { ProjectController } from './project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import Project from '@common/entities/project/project.entity';
import Account from '@common/entities/auth/account.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Project,
            Account,
            AccessGroup,
            TagType,
            ProjectAccess,
        ]),
    ],
    providers: [ProjectService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
export class ProjectModule {}
