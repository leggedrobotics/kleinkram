import { MetadataService } from '@/services/metadata.service';
import { AccessGroupEntity, ApiKeyEntity } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetadataTypeController } from './metadata-type.controller';
import { MetadataController } from './metadata.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MetadataEntity,
            TagTypeEntity,
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
