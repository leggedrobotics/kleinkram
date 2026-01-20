import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { type Faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';

export interface MetadataContext {
    mission: MissionEntity;
    tagType: TagTypeEntity;
    creator: UserEntity;

    // Optional metadata values
    valueString?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    valueDate?: Date;
    valueLocation?: string;
}

setSeederFactory(
    MetadataEntity,
    (_faker: Faker, context: Partial<MetadataContext> = {}) => {
        const {
            mission,
            tagType,
            creator,
            valueString,
            valueNumber,
            valueBoolean,
            valueDate,
            valueLocation,
        } = context;

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
        if (valueString !== undefined) {
            metadata.value_string = valueString;
        }
        if (valueNumber !== undefined) {
            metadata.value_number = valueNumber;
        }
        if (valueBoolean !== undefined) {
            metadata.value_boolean = valueBoolean;
        }
        if (valueDate !== undefined) {
            metadata.value_date = valueDate;
        }
        if (valueLocation !== undefined) {
            metadata.value_location = valueLocation;
        }

        return metadata;
    },
);
