import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrationDockerRefactor1765363646576 implements MigrationInterface {
    name = 'MigrationDockerRefactor1765363646576';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'project_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "project_access_view_entity"`);
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'mission_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "mission_access_view_entity"`);
        await queryRunner.query(`CREATE VIEW "project_access_view_entity" AS
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
    `);
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'project_access_view_entity',
                'SELECT\n            "project"."uuid" AS "projectuuid",\n            "user"."uuid" AS "useruuid",\n            MAX("projectAccesses"."rights") AS "rights"\n        FROM "project" "project"\n        INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid" = "project"."uuid"\n        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "projectAccesses"."accessGroupUuid"\n        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid" AND ("memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW())\n        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"\n        GROUP BY "project"."uuid", "user"."uuid"',
            ],
        );
        await queryRunner.query(`CREATE VIEW "mission_access_view_entity" AS
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
    `);
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'mission_access_view_entity',
                'SELECT\n            "mission"."uuid" AS "missionuuid",\n            "user"."uuid" AS "useruuid",\n            MAX("missionAccesses"."rights") AS "rights"\n        FROM "mission" "mission"\n        INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid" = "mission"."uuid"\n        INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid" = "missionAccesses"."accessGroupUuid"\n        INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid" = "accessGroup"."uuid"\n        INNER JOIN "user" "user" ON "user"."uuid" = "memberships"."userUuid"\n        GROUP BY "mission"."uuid", "user"."uuid"',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'mission_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "mission_access_view_entity"`);
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'project_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "project_access_view_entity"`);
        await queryRunner.query(
            `CREATE VIEW "mission_access_view_entity" AS SELECT "mission"."uuid" as missionUUID, "user"."uuid" as userUUID, MAX("missionAccesses"."rights") as rights FROM "mission" "mission" INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid"="mission"."uuid" AND ("missionAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="missionAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ("memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "mission"."deletedAt" IS NULL GROUP BY "mission"."uuid", "user"."uuid"`,
        );
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'mission_access_view_entity',
                'SELECT "mission"."uuid" as missionUUID, "user"."uuid" as userUUID, MAX("missionAccesses"."rights") as rights FROM "mission" "mission" INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid"="mission"."uuid" AND ("missionAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="missionAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ("memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "mission"."deletedAt" IS NULL GROUP BY "mission"."uuid", "user"."uuid"',
            ],
        );
        await queryRunner.query(
            `CREATE VIEW "project_access_view_entity" AS SELECT "project"."uuid" as projectUUID, "user"."uuid" as userUUID, MAX("projectAccesses"."rights") as rights FROM "project" "project" INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid"="project"."uuid" AND ("projectAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="projectAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ( "memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW() AND "memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "project"."deletedAt" IS NULL GROUP BY "project"."uuid", "user"."uuid"`,
        );
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'project_access_view_entity',
                'SELECT "project"."uuid" as projectUUID, "user"."uuid" as userUUID, MAX("projectAccesses"."rights") as rights FROM "project" "project" INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid"="project"."uuid" AND ("projectAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="projectAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ( "memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW() AND "memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "project"."deletedAt" IS NULL GROUP BY "project"."uuid", "user"."uuid"',
            ],
        );
    }
}
