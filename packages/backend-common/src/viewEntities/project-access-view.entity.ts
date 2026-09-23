import { AccessGroupRights } from '@kleinkram/shared';
import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * The highest rights every user has on every project they can access.
 *
 * Rights come from two sources:
 *  - the access groups the user is a member of (unexpired memberships only);
 *  - the `PUBLIC` access group, which every user implicitly belongs to. It
 *    has no membership rows, so it is joined with all users instead. Its
 *    rights are always READ, regardless of what is stored on the row.
 */
@ViewEntity({
    expression: `
        SELECT
            "access"."projectuuid" AS "projectuuid",
            "access"."useruuid" AS "useruuid",
            MAX("access"."rights") AS "rights"
        FROM (
            SELECT
                "projectAccesses"."projectUuid" AS "projectuuid",
                "memberships"."userUuid" AS "useruuid",
                "projectAccesses"."rights" AS "rights"
            FROM "project_access" "projectAccesses"
            INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"
            INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())
            UNION ALL
            SELECT
                "projectAccesses"."projectUuid" AS "projectuuid",
                "user"."uuid" AS "useruuid",
                '0'::"project_access_rights_enum" AS "rights"
            FROM "project_access" "projectAccesses"
            INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid" AND "accessGroup"."type" = 'PUBLIC'
            CROSS JOIN "user" "user"
        ) "access"
        GROUP BY "access"."projectuuid", "access"."useruuid"
    `,
})
export class ProjectAccessViewEntity {
    @ViewColumn({ name: 'projectuuid' })
    projectUuid!: string;

    @ViewColumn({ name: 'useruuid' })
    userUuid!: string;

    /** The highest level of access rights the user has for the project. */
    @ViewColumn({
        transformer: {
            from: (value: string) => Number.parseInt(value, 10),
            to: (value: number) => value,
        },
    })
    rights!: AccessGroupRights;
}
