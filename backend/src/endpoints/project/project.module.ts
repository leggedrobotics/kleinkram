import { ProjectService } from '@/services/project.service';
import {
    AccessGroupEntity,
    AccessGroupEventEntity,
    GroupMembershipEntity,
    ProjectEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { ProjectController } from './project.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            AccessGroupEventEntity,
            TagTypeEntity,
            ProjectAccessEntity,
            UserEntity,
            GroupMembershipEntity,
        ]),
        AccessModule,
    ],
    providers: [ProjectService],
    exports: [ProjectService],
    controllers: [ProjectController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ProjectModule {}
