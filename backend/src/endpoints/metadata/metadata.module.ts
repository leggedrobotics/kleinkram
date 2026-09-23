import { MetadataService } from '@/services/metadata.service';
import { AccessGroupEntity, ApiKeyEntity } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { MetadataTypeEntity } from '@kleinkram/backend-common/entities/metadata/metadata-type.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetadataTypeController } from './metadata-type.controller';
import { MetadataController } from './metadata.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MetadataEntity,
            MetadataTypeEntity,
            MissionEntity,
            AccessGroupEntity,
            ProjectEntity,
            AccountEntity,
            ApiKeyEntity,
        ]),
    ],
    providers: [MetadataService],
    controllers: [MetadataTypeController, MetadataController],
    exports: [MetadataService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MetadataModule {}
