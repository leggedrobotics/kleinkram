import { Brackets, SelectQueryBuilder } from 'typeorm';

export function addAccessConstraints(
    qb: SelectQueryBuilder<any>,
    userUUID: string,
): SelectQueryBuilder<any> {
    // Add project access join
    qb.leftJoin(
        (subQuery) => {
            return subQuery
                .select(
                    'DISTINCT "projectAccessView"."projectuuid"',
                    'projectuuid',
                )
                .from('project_access_view_entity', 'projectAccessView')
                .where('"projectAccessView"."useruuid" = :userUUID', {
                    userUUID,
                });
        },
        'projectAccess',
        '"projectAccess"."projectuuid" = "project"."uuid"',
    );

    // Add mission access join
    qb.leftJoin(
        (subQuery) => {
            return subQuery
                .select(
                    'DISTINCT "missionAccessView"."missionuuid"',
                    'missionuuid',
                )
                .from('mission_access_view_entity', 'missionAccessView')
                .where('"missionAccessView"."useruuid" = :userUUID', {
                    userUUID,
                });
        },
        'missionAccess',
        '"missionAccess"."missionuuid" = "mission"."uuid"',
    );

    qb.andWhere(
        new Brackets((qb) => {
            qb.where('"missionAccess"."missionuuid" IS NOT NULL').orWhere(
                '"projectAccess"."projectuuid" IS NOT NULL',
            );
        }),
    );

    return qb;
}
