import { Brackets, SelectQueryBuilder } from 'typeorm';

export function addAccessJoinsAndConditions(
    qb: SelectQueryBuilder<any>,
    userUUID: string,
): SelectQueryBuilder<any> {
    return qb
        .leftJoin(
            'ProjectAccessViewEntity',
            'projectAccessView',
            'projectAccessView.projectuuid = project.uuid',
        )
        .leftJoin(
            'MissionAccessViewEntity',
            'missionAccessView',
            'missionAccessView.missionuuid = mission.uuid',
        )
        .leftJoin(
            'user',
            'projectUsers',
            'projectAccessView.useruuid = projectUsers.uuid',
        )
        .leftJoin(
            'user',
            'missionUsers',
            'missionAccessView.useruuid = missionUsers.uuid',
        )
        .where(
            new Brackets((qb) => {
                qb.where('projectUsers.uuid = :user', {
                    user: userUUID,
                }).orWhere('missionUsers.uuid = :user', { user: userUUID });
            }),
        );
}
