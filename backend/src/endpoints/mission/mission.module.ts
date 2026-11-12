import { MetadataService } from '@/services/metadata.service';
import { MissionService } from '@/services/mission.service';
import { UserService } from '@/services/user.service';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { MetadataTypeEntity } from '@kleinkram/backend-common/entities/metadata/metadata-type.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionController } from './mission.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            MetadataEntity,
            MetadataTypeEntity,
        ]),
        StorageModule,
    ],
    providers: [MissionService, UserService, MetadataService],
    controllers: [MissionController],
    exports: [MissionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MissionModule {}
