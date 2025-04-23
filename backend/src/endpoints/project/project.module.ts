import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import Project from '@common/entities/project/project.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessService } from '../../services/access.service';
import { ProjectService } from '../../services/project.service';
import { OldProjectController, ProjectController } from './project.controller';

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
    providers: [ProjectService, AccessService],
    exports: [ProjectService],
    controllers: [ProjectController, OldProjectController],
})
export class ProjectModule {}
