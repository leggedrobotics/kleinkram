import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { define } from 'typeorm-seeding';

export interface MetadataContext {
    mission: MissionEntity;
    tagType: TagTypeEntity;
    creator: UserEntity;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_string?: string;
}

define(MetadataEntity, (_, context: Partial<MetadataContext> = {}) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { mission, tagType, creator, value_string } = context;

    if (!mission) {
        throw new Error('Mission is required');
    }
    if (!tagType) {
        throw new Error('TagType is required');
    }

    if (!creator) {
        throw new Error('Creator is required');
    }

    const metadata = new MetadataEntity();
    metadata.mission = mission;
    metadata.tagType = tagType;
    metadata.creator = creator;
    if (value_string) {
        metadata.value_string = value_string;
    }

    return metadata;
});
