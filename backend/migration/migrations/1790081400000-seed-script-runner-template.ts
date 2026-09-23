import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes `klein action run-script` work on every deployment, old and new.
 *
 * The runner template is infrastructure rather than user content: every script
 * execution points at it, so it is seeded here instead of being left for an
 * admin to create, and marked `isSystem` so the update and delete paths refuse
 * to touch it.
 *
 * The uuid is fixed so every deployment refers to the same template, and so
 * running the migration again cannot insert a second one.
 */
export class SeedScriptRunnerTemplate1790081400000 implements MigrationInterface {
    name = 'SeedScriptRunnerTemplate1790081400000';

    /** Matches SCRIPT_RUNNER_TEMPLATE_UUID in @kleinkram/shared; frozen here. */
    private static readonly TEMPLATE_UUID =
        '00000000-0000-4000-8000-00000000c0de';
    private static readonly TEMPLATE_NAME = 'script-runner';
    private static readonly IMAGE = 'rslethz/action:script-runner-latest';

    /** The System user, established by UpdateSystemUserUuid1769000000000. */
    private static readonly SYSTEM_USER_UUID =
        '00000000-0000-4000-8000-000000000000';

    /** Matches `systemUser` in @kleinkram/backend-common; frozen here. */
    private static readonly SYSTEM_USER = {
        name: 'System',
        email: 'infrastructure@leggedrobotics.com',
        avatarUrl: 'https://datasets.leggedrobotics.com/logoRSL.png',
    };

    public async up(queryRunner: QueryRunner): Promise<void> {
        // IF NOT EXISTS because a dev database running with TypeORM
        // synchronize will already have the column from the entity.
        await queryRunner.query(
            `ALTER TABLE "action_template"
             ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false`,
        );

        // The template is owned by the System user. The backend creates that
        // user on startup, which is after the migrations on a fresh
        // database, so create it here the same way when it is missing.
        await queryRunner.query(
            `INSERT INTO "user" ("uuid", "name", "email", "role", "hidden", "avatarUrl")
             VALUES ($1, $2, $3, 'USER', true, $4)
             ON CONFLICT DO NOTHING`,
            [
                SeedScriptRunnerTemplate1790081400000.SYSTEM_USER_UUID,
                SeedScriptRunnerTemplate1790081400000.SYSTEM_USER.name,
                SeedScriptRunnerTemplate1790081400000.SYSTEM_USER.email,
                SeedScriptRunnerTemplate1790081400000.SYSTEM_USER.avatarUrl,
            ],
        );

        // Always insert the platform's own row, never adopt an existing one:
        // a `script-runner` template made by hand before this shipped points at
        // whatever image its author chose, and flagging it as system would run
        // every submitted script on it. Such a template keeps working for the
        // actions that reference it, but stays an ordinary user template; the
        // seeded row takes the next free version so the (name, version) index
        // cannot collide with it.
        //
        // The parameters are cast explicitly: `$2` is used both as a value
        // and in a comparison, and Postgres refuses to infer two different
        // types (text and varchar) for it.
        await queryRunner.query(
            `INSERT INTO "action_template" (
                 "uuid", "name", "description", "image_name",
                 "cpuCores", "cpuMemory", "gpuMemory", "maxRuntime",
                 "accessRights", "version", "isArchived", "isSystem",
                 "creatorUuid"
             )
             SELECT $1::uuid, $2::varchar, $3::varchar, $4::varchar,
                    2, 4, -1, 0.25,
                    '20'::action_template_accessrights_enum,
                    COALESCE((
                        SELECT MAX(t."version") FROM "action_template" t
                         WHERE t."name" = $2::varchar
                    ), 0) + 1,
                    false, true,
                    $5::uuid
             WHERE NOT EXISTS (
                 SELECT 1 FROM "action_template" t WHERE t."uuid" = $1::uuid
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
