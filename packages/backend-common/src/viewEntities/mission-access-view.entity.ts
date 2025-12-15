import { AccessGroupRights } from '@kleinkram/shared';
import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
    expression: `
        SELECT
            "mission"."uuid" AS "missionuuid",
            "user"."uuid" AS "useruuid",
            MAX("missionAccesses"."rights") AS "rights"
        FROM "mission" "mission"
        INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid" = "mission"."uuid"
        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "missionAccesses"."accessGroupUuid"
        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid"
        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"
        GROUP BY "mission"."uuid", "user"."uuid"
    `,
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
