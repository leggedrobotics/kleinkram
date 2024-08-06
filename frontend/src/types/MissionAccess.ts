import { Mission } from 'src/types/Mission';
import { AccessGroup } from 'src/types/AccessGroup';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { BaseEntity } from 'src/types/BaseEntity';

export class MissionAccess extends BaseEntity {
    rights: AccessGroupRights;
    accessGroup: AccessGroup;
    missions: Mission[];

    constructor(
        uuid: string,
        rights: AccessGroupRights,
        accessGroup: AccessGroup,
        missions: Mission[],
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.rights = rights;
        this.accessGroup = accessGroup;
        this.missions = missions;
    }
}
