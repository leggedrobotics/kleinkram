import { MetadataTypeEntity } from '@backend-common/entities/metadata/metadata-type.entity';
import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { setSeederFactory } from 'typeorm-extension';

export interface MetadataContext {
    mission: MissionEntity;
    metadataType: MetadataTypeEntity;
    creator: UserEntity;

    // Optional metadata values
    valueString?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    valueDate?: Date;
    valueLocation?: string;
}

setSeederFactory(MetadataEntity, (context: Partial<MetadataContext> = {}) => {
    const {
        mission,
        metadataType,
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
    if (!metadataType) {
        throw new Error('MetadataType is required');
    }

    if (!creator) {
        throw new Error('Creator is required');
    }

    const metadata = new MetadataEntity();
    metadata.mission = mission;
    metadata.metadataType = metadataType;
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
});
