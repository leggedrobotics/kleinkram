import { define } from 'typeorm-seeding';
import MetadataEntity from '../../entities/metadata/metadata.entity';
import MissionEntity from '../../entities/mission/mission.entity';
import TagTypeEntity from '../../entities/tagType/tag-type.entity';
import UserEntity from '../../entities/user/user.entity';

export interface MetadataContext {
    mission: MissionEntity;
    tagType: TagTypeEntity;
    creator: UserEntity;
    value_string?: string;
}

define(MetadataEntity, (_, context: Partial<MetadataContext> = {}) => {
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
