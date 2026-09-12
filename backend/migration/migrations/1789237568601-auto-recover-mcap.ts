import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoRecoverMcap1789237568601 implements MigrationInterface {
    name = 'AutoRecoverMcap1789237568601';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add CORRUPTED_FILE to action_trigger_type_enum
        await queryRunner.query(
            `ALTER TYPE "public"."action_trigger_type_enum" ADD VALUE IF NOT EXISTS 'CORRUPTED_FILE'`,
        );

        // 2. Add projectUuid to action_trigger, make missionUuid nullable, and update foreign keys
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD "projectUuid" uuid`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ALTER COLUMN "missionUuid" DROP NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT IF EXISTS "FK_dbfcd510d391a89e096047f75ad"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_dbfcd510d391a89e096047f75ad" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_d351ca951638b919694a25018bd" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );

        // 3. Add fileUuid and container_logs to action
        await queryRunner.query(`ALTER TABLE "action" ADD "fileUuid" uuid`);
        await queryRunner.query(
            `ALTER TABLE "action" ADD "container_logs" json DEFAULT '[]'`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_b32d5c5f495f0825273afa03e69" FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );

        // 4. Add autoRecoverMcap to project
        await queryRunner.query(
            `ALTER TABLE "project" ADD "autoRecoverMcap" boolean NOT NULL DEFAULT true`,
        );

        // 5. Seed recover-mcap action template
        await queryRunner.query(`
            INSERT INTO "action_template" (
                "uuid", "name", "version", "description", "image_name", "accessRights", "cpuCores", "cpuMemory", "gpuMemory", "maxRuntime"
            )
            SELECT
                'b12a87c1-0000-4000-a000-000000000001',
                'recover-mcap',
                1,
                'Automatically recover corrupted MCAP files using mcap doctor and mcap recover',
                'rslethz/action:recover-mcap-latest',
                '20',
                1,
                1024,
                -1,
                1
            WHERE NOT EXISTS (
                SELECT 1 FROM "action_template" WHERE "name" = 'recover-mcap' AND "version" = 1
            )
        `);

        // 6. Add auto-recover trigger for all existing projects
        await queryRunner.query(`
            INSERT INTO "action_trigger" (
                "name", "description", "templateUuid", "projectUuid", "type", "config", "creatorUuid"
            )
            SELECT
                'Auto-recover MCAP',
                'Automatically recovers corrupted MCAP files uploaded to this project',
                t."uuid",
                p."uuid",
                'CORRUPTED_FILE',
                '{"patterns": ["*.mcap"]}',
                p."creatorUuid"
            FROM "project" p
            CROSS JOIN (
                SELECT "uuid" FROM "action_template" WHERE "name" = 'recover-mcap' AND "version" = 1 LIMIT 1
            ) t
            WHERE NOT EXISTS (
                SELECT 1 FROM "action_trigger" at
                WHERE at."projectUuid" = p."uuid" AND at."type" = 'CORRUPTED_FILE'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "action_trigger" WHERE "type" = 'CORRUPTED_FILE'
        `);
        await queryRunner.query(
            `ALTER TABLE "project" DROP COLUMN "autoRecoverMcap"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_b32d5c5f495f0825273afa03e69"`,
        );
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "fileUuid"`);
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "container_logs"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT "FK_d351ca951638b919694a25018bd"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT "FK_dbfcd510d391a89e096047f75ad"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_dbfcd510d391a89e096047f75ad" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP COLUMN "projectUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ALTER COLUMN "missionUuid" SET NOT NULL`,
        );
    }
}
