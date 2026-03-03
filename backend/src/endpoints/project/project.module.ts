import { AccessService } from '@/services/access.service';
import { ProjectService } from '@/services/project.service';
import { AccessGroupEntity, ProjectEntity } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OldProjectController, ProjectController } from './project.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            TagTypeEntity,
            ProjectAccessEntity,
            MissionEntity,
        ]),
        StorageModule,
    ],
    providers: [ProjectService, AccessService],
    exports: [ProjectService],
    controllers: [ProjectController, OldProjectController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ProjectModule {}
