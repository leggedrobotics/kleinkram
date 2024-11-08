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
    ) {
        super(uuid, createdAt, updatedAt);
        this.rights = rights;
        this.accessGroup = accessGroup;
        this.missions = missions;
    }

    static fromAPIResponse(response: any): MissionAccess {
        const accessGroup = AccessGroup.fromAPIResponse(response.accessGroup);
        const missions = response.missions.map((mission: any) =>
            Mission.fromAPIResponse(mission),
        );
        return new MissionAccess(
            response.uuid,
            response.rights,
            accessGroup,
            missions,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
