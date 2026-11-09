import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the PUBLIC access group type and lets every user read the projects
 * that grant the public access group access (see `AccessGroupType.PUBLIC`).
 *
 * The group itself is created by the backend on startup, like the
 * affiliation groups.
 */
export class AddPublicAccessGroup1790176718482 implements MigrationInterface {
    name = 'AddPublicAccessGroup1790176718482';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'project_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "project_access_view_entity"`);
        // Recreate the enum instead of `ADD VALUE`: a value added to an
        // existing enum cannot be used in the same transaction, and the view
        // below compares against 'PUBLIC'.
        await queryRunner.query(
            `ALTER TYPE "public"."access_group_type_enum" RENAME TO "access_group_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_type_enum" AS ENUM('AFFILIATION', 'PRIMARY', 'CUSTOM', 'PUBLIC')`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" TYPE "public"."access_group_type_enum" USING "type"::"text"::"public"."access_group_type_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" SET DEFAULT 'CUSTOM'`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."access_group_type_enum_old"`,
        );
        await queryRunner.query(`CREATE VIEW "project_access_view_entity" AS
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
    `);
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'project_access_view_entity',
                'SELECT\n            "access"."projectuuid" AS "projectuuid",\n            "access"."useruuid" AS "useruuid",\n            MAX("access"."rights") AS "rights"\n        FROM (\n            SELECT\n                "projectAccesses"."projectUuid" AS "projectuuid",\n                "memberships"."userUuid" AS "useruuid",\n                "projectAccesses"."rights" AS "rights"\n            FROM "project_access" "projectAccesses"\n            INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"\n            INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())\n            UNION ALL\n            SELECT\n                "projectAccesses"."projectUuid" AS "projectuuid",\n                "user"."uuid" AS "useruuid",\n                \'0\'::"project_access_rights_enum" AS "rights"\n            FROM "project_access" "projectAccesses"\n            INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid" AND "accessGroup"."type" = \'PUBLIC\'\n            CROSS JOIN "user" "user"\n        ) "access"\n        GROUP BY "access"."projectuuid", "access"."useruuid"',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The old enum has no PUBLIC value, so public access has to go first.
        // Reverting makes all public projects restricted again.
        await queryRunner.query(
            `DELETE FROM "project_access" WHERE "accessGroupUuid" IN (SELECT "uuid" FROM "access_group" WHERE "type" = 'PUBLIC')`,
        );
        await queryRunner.query(
            `DELETE FROM "access_group" WHERE "type" = 'PUBLIC'`,
        );
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'project_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "project_access_view_entity"`);
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_type_enum_old" AS ENUM('AFFILIATION', 'PRIMARY', 'CUSTOM')`,
        );
        // the column default cannot be cast to the new type automatically
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" TYPE "public"."access_group_type_enum_old" USING "type"::"text"::"public"."access_group_type_enum_old"`,
        );
        await queryRunner.query(`DROP TYPE "public"."access_group_type_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."access_group_type_enum_old" RENAME TO "access_group_type_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ALTER COLUMN "type" SET DEFAULT 'CUSTOM'`,
        );
        await queryRunner.query(`CREATE VIEW "project_access_view_entity" AS SELECT
            "project"."uuid" AS "projectuuid",
            "user"."uuid" AS "useruuid",
            MAX("projectAccesses"."rights") AS "rights"
        FROM "project" "project"
        INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid" = "project"."uuid"
        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"
        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())
        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"
        GROUP BY "project"."uuid", "user"."uuid"`);
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'project_access_view_entity',
                'SELECT\n            "project"."uuid" AS "projectuuid",\n            "user"."uuid" AS "useruuid",\n            MAX("projectAccesses"."rights") AS "rights"\n        FROM "project" "project"\n        INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid" = "project"."uuid"\n        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"\n        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())\n        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"\n        GROUP BY "project"."uuid", "user"."uuid"',
            ],
        );
    }
}
