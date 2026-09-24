import { ProjectArchiveService } from '@/services/project-archive.service';
import { ProjectService } from '@/services/project.service';
import {
    AccessGroupEntity,
    AccessGroupEventEntity,
    GroupMembershipEntity,
    ProjectArchiveEntity,
    ProjectEntity,
    ProjectStarEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { MetadataTypeEntity } from '@kleinkram/backend-common/entities/metadata/metadata-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { ProjectController } from './project.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            ProjectArchiveEntity,
            ProjectStarEntity,
            AccountEntity,
            AccessGroupEntity,
            AccessGroupEventEntity,
            MetadataTypeEntity,
            ProjectAccessEntity,
            UserEntity,
            GroupMembershipEntity,
        ]),
        AccessModule,
    ],
    providers: [ProjectService, ProjectArchiveService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ProjectModule {}
