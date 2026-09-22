import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes `klein action run-script` work on every deployment, old and new.
 *
 * The runner template is infrastructure rather than user content: every script
 * execution points at it, so it is seeded here instead of being left for an
 * admin to create, and marked `isSystem` so the update and delete paths refuse
 * to touch it.
 *
 * The uuid is fixed so every deployment refers to the same template, and so a
 * deployment where someone already created one by hand converges on it rather
 * than ending up with two.
 */
export class SeedScriptRunnerTemplate1790081400000 implements MigrationInterface {
    name = 'SeedScriptRunnerTemplate1790081400000';

    /** Matches SCRIPT_RUNNER_TEMPLATE_UUID in @kleinkram/shared. */
    private static readonly TEMPLATE_UUID =
        '00000000-0000-4000-8000-00000000c0de';
    private static readonly TEMPLATE_NAME = 'script-runner';
    private static readonly IMAGE = 'rslethz/action:script-runner-latest';

    /** The System user, established by UpdateSystemUserUuid1769000000000. */
    private static readonly SYSTEM_USER_UUID =
        '00000000-0000-4000-8000-000000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // IF NOT EXISTS because a dev database running with TypeORM
        // synchronize will already have the column from the entity.
        await queryRunner.query(
            `ALTER TABLE "action_template"
             ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false`,
        );

        // Adopt a template an admin made by hand before this shipped: existing
        // actions point at it, and the unique (name, version) index would
        // reject a second one anyway.
        await queryRunner.query(
            `UPDATE "action_template"
                SET "isSystem" = true
              WHERE "name" = $1
                AND "deletedAt" IS NULL`,
            [SeedScriptRunnerTemplate1790081400000.TEMPLATE_NAME],
        );

        await queryRunner.query(
            `INSERT INTO "action_template" (
                 "uuid", "name", "description", "image_name",
                 "cpuCores", "cpuMemory", "gpuMemory", "maxRuntime",
                 "accessRights", "version", "isArchived", "isSystem",
                 "creatorUuid"
             )
             SELECT $1, $2, $3, $4,
                    2, 4, -1, 0.25,
                    '20'::action_template_accessrights_enum, 1, false, true,
                    $5
             WHERE NOT EXISTS (
                 SELECT 1 FROM "action_template" t
                  WHERE t."name" = $2
                    AND t."deletedAt" IS NULL
             )`,
            [
                SeedScriptRunnerTemplate1790081400000.TEMPLATE_UUID,
                SeedScriptRunnerTemplate1790081400000.TEMPLATE_NAME,
                'Runs a single Python file submitted with `klein action run-script`. Managed by Kleinkram.',
                SeedScriptRunnerTemplate1790081400000.IMAGE,
                SeedScriptRunnerTemplate1790081400000.SYSTEM_USER_UUID,
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Only remove the seeded row, and only when nothing ran on it: a
        // deployment with script executions has to keep the template its
        // actions reference.
        await queryRunner.query(
            `DELETE FROM "action_template"
              WHERE "uuid" = $1
                AND NOT EXISTS (
                    SELECT 1 FROM "action" a WHERE a."templateUuid" = $1
                )`,
            [SeedScriptRunnerTemplate1790081400000.TEMPLATE_UUID],
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN IF EXISTS "isSystem"`,
        );
    }
}
