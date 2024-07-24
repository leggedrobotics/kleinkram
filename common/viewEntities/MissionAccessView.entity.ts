import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { AccessGroupRights } from '../enum';
import Mission from '../entities/mission/mission.entity';

@ViewEntity({
    expression: (datasource: DataSource) =>
        datasource
            .createQueryBuilder()
            .from(Mission, 'mission')
            .innerJoin('mission.mission_accesses', 'missionAccesses')
            .innerJoin('missionAccesses.accessGroup', 'accessGroup')
            .innerJoin('accessGroup.users', 'users')
            .select([
                'mission.uuid as missionUUID',
                'users.uuid as userUUID',
                'missionAccesses.rights as rights',
                'accessGroup.uuid as accessGroupUUID',
                'missionAccesses.uuid as missionAccessUUID',
            ]),
})
export class MissionAccessViewEntity {
    @ViewColumn()
    missionUUID: string;

    @ViewColumn()
    userUUID: string;

    @ViewColumn()
    rights: AccessGroupRights;

    @ViewColumn()
    accessGroupUUID: string;

    @ViewColumn()
    missionAccessUUID: string;
}
