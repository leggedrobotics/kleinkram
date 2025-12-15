import { AccessGroupRights } from '@kleinkram/shared';
import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
    expression: `
        SELECT
            "project"."uuid" AS "projectuuid",
            "user"."uuid" AS "useruuid",
            MAX("projectAccesses"."rights") AS "rights"
        FROM "project" "project"
        INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid" = "project"."uuid"
        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"
        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())
        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"
        GROUP BY "project"."uuid", "user"."uuid"
    `,
})
export class ProjectAccessViewEntity {
    @ViewColumn({ name: 'projectuuid' })
    projectUuid!: string;

    @ViewColumn({ name: 'useruuid' })
    userUuid!: string;

    /** The highest level of access rights the user has for the project. */
    @ViewColumn()
    rights!: AccessGroupRights;
}
