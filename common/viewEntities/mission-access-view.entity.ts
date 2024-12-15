import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import Mission from '../entities/mission/mission.entity';

import { AccessGroupRights } from '../frontend_shared/enum';

@ViewEntity({
    expression: (datasource: DataSource) =>
        datasource
            .createQueryBuilder()
            .from(Mission, 'mission')
            .innerJoin('mission.mission_accesses', 'missionAccesses')
            .innerJoin('missionAccesses.accessGroup', 'accessGroup')
            .innerJoin('accessGroup.memberships', 'memberships')
            .innerJoin('memberships.user', 'users')
            .select([
                'mission.uuid as missionUUID',
                'users.uuid as userUUID',
                'missionAccesses.rights as rights',
                'accessGroup.uuid as accessGroupUUID',
                'missionAccesses.uuid as missionAccessUUID',
            ]),
})
export class MissionAccessViewEntity {
    @ViewColumn({ name: 'missionuuid' })
    missionUUID!: string;

    @ViewColumn({ name: 'useruuid' })
    userUUID!: string;

    @ViewColumn({ name: 'rights' })
    rights!: AccessGroupRights;

    @ViewColumn({ name: 'accessgroupuuid' })
    accessGroupUUID!: string;

    @ViewColumn({ name: 'missionaccessuuid' })
    missionAccessUUID!: string;
}
