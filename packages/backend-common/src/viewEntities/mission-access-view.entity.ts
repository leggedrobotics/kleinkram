import MissionEntity from '@backend-common/entities/mission/mission.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import type { DataSource } from 'typeorm';
import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
    expression: (datasource: DataSource) =>
        datasource
            .createQueryBuilder(MissionEntity, 'mission')
            .innerJoin('mission.mission_accesses', 'missionAccesses')
            .innerJoin('missionAccesses.accessGroup', 'accessGroup')
            .innerJoin('accessGroup.memberships', 'memberships')
            .innerJoin('memberships.user', 'user')
            .select([
                'mission.uuid as missionUUID',
                'user.uuid as userUUID',
                // Aggregate to find the highest level of rights
                'MAX(missionAccesses.rights) as rights',
            ])
            // Group by user and mission to get one row per pair
            .groupBy('mission.uuid')
            .addGroupBy('user.uuid'),
})
export class MissionAccessViewEntity {
    @ViewColumn({ name: 'missionuuid' })
    missionUuid!: string;

    @ViewColumn({ name: 'useruuid' })
    userUuid!: string;

    /** The highest level of access rights the user has for the mission. */
    @ViewColumn({ name: 'rights' })
    rights!: AccessGroupRights;
}
