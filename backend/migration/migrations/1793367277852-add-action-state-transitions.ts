import { MigrationInterface, QueryRunner } from 'typeorm';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Causes that were written as fixed text, by the text. Exactly the strings
 * the code produced before cause codes existed.
 */
const FIXED_CAUSES: [text: string, code: string][] = [
    ['Container exited with code 0', 'COMPLETED'],
    [
        'Container failed to run. Docker run command failed.',
        'EXIT_DOCKER_RUN_FAILED',
    ],
    [
        'Command cannot be invoked (Permission denied?).',
        'EXIT_PERMISSION_DENIED',
    ],
    ['Command not found.', 'EXIT_COMMAND_NOT_FOUND'],
    ['Container crashed (SIGSEGV). Invalid memory access.', 'EXIT_SEGFAULT'],
    ['Container stopped (SIGTERM). Time limit approached.', 'EXIT_SIGTERM'],
    [
        'Container killed (SIGKILL). Exceeded memory or CPU limit.',
        'EXIT_SIGKILL',
    ],
    [
        'Container killed (SIGKILL). Exceeded memory or CPU limit. The container ran out of memory (OOMKilled).',
        'OUT_OF_MEMORY',
    ],
    ['Time limit exceeded', 'TIME_LIMIT_EXCEEDED'],
    [
        'Interrupted by new Runner Instance (old runner inactive)',
        'RUNNER_REPLACED',
    ],
    ['Interrupted by new Runner Instance', 'RUNNER_REPLACED'],
    [
        'Container killed by Janitor: action no longer active',
        'ORPHANED_CONTAINER_KILLED',
    ],
    ['Container crashed, no container found', 'CONTAINER_LOST'],
    [
        'No worker available with the required hardware capabilities',
        'NO_WORKER_AVAILABLE',
    ],
    ['Resources unavailable or queue error', 'QUEUE_ERROR'],
    ['Worker not found', 'WORKER_NOT_FOUND'],
    ['Action cancelled by user', 'CANCELLED_BY_USER'],
];

export class AddActionStateTransitions1793367277852 implements MigrationInterface {
    name = 'AddActionStateTransitions1793367277852';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."action_state_transition_state_enum" AS ENUM('PENDING', 'STARTING', 'PROCESSING', 'STOPPING', 'DONE', 'FAILED', 'UNPROCESSABLE', 'CANCELLED')`,
        );
        await queryRunner.query(
            `CREATE TABLE "action_state_transition" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "state" "public"."action_state_transition_state_enum" NOT NULL, "causeCode" character varying(64), "causeParams" jsonb, "message" text, "actionUuid" uuid NOT NULL, "actorUuid" uuid, CONSTRAINT "PK_27b42c6dd13d41fb96f00c2d7ae" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_action_state_transition_action" ON "action_state_transition"  ("actionUuid", "createdAt") `,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "state_cause_code" character varying(64)`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "state_cause_params" jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_state_transition" ADD CONSTRAINT "FK_3a2292c2be0ef3f9b7dff8aa2a5" FOREIGN KEY ("actionUuid") REFERENCES "action"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_state_transition" ADD CONSTRAINT "FK_107cdba32a7e4493c9dd965c2d0" FOREIGN KEY ("actorUuid") REFERENCES "user"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );

        await this.backfillCauseCodes(queryRunner);
        await this.backfillHistory(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Waiting causes are stored as the bare error now; give them back the
        // prefix the code before this migration wrote and reads.
        await queryRunner.query(
            `UPDATE "action" SET "state_cause" = 'Pending... ' || "state_cause"
             WHERE "state_cause_code" = 'WAITING_FOR_RESOURCES'`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_state_transition" DROP CONSTRAINT "FK_107cdba32a7e4493c9dd965c2d0"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_state_transition" DROP CONSTRAINT "FK_3a2292c2be0ef3f9b7dff8aa2a5"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "state_cause_params"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "state_cause_code"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."idx_action_state_transition_action"`,
        );
        await queryRunner.query(`DROP TABLE "action_state_transition"`);
        await queryRunner.query(
            `DROP TYPE "public"."action_state_transition_state_enum"`,
        );
    }

    /**
     * Gives existing actions the code for the text they were written with.
     * Free-text causes (exceptions, Docker errors) keep no code; they are
     * shown as stored.
     */
    private async backfillCauseCodes(queryRunner: QueryRunner): Promise<void> {
        for (const [text, code] of FIXED_CAUSES) {
            await queryRunner.query(
                `UPDATE "action" SET "state_cause_code" = $1 WHERE "state_cause" = $2`,
                [code, text],
            );
        }

        await queryRunner.query(
            `UPDATE "action"
             SET "state_cause_code" = 'COMPLETED_WITH_WARNINGS',
                 "state_cause_params" = jsonb_build_object('exitCode', (substring("state_cause" from '\\(exit (-?[0-9]+)\\)'))::int)
             WHERE "state_cause" ~ '^Action completed with warnings \\(exit -?[0-9]+\\)\\.$'`,
        );
        await queryRunner.query(
            `UPDATE "action"
             SET "state_cause_code" = 'EXIT_NONZERO',
                 "state_cause_params" = jsonb_build_object('exitCode', (substring("state_cause" from '(-?[0-9]+)$'))::int)
             WHERE "state_cause" ~ '^Container exited with code -?[0-9]+$'
               AND "state_cause" <> 'Container exited with code 0'`,
        );

        // Written with the creator's and mission's uuids, either bare or as
        // {user:…} references (#2516). The text stays as it was: with the code
        // set, it is rebuilt from the current names and never shown.
        await queryRunner.query(
            `UPDATE "action"
             SET "state_cause_code" = 'MISSION_ACCESS_LOST'
             WHERE "state_cause" ~ '^User (\\{user:)?${UUID}\\}? lost access to mission (\\{mission:)?${UUID}\\}?$'`,
        );

        // The raw error is kept as the message; the text is rebuilt around it.
        await queryRunner.query(
            `UPDATE "action"
             SET "state_cause_code" = 'WAITING_FOR_RESOURCES',
                 "state_cause" = substring("state_cause" from '^Pending\\.\\.\\. (.*)$')
             WHERE "state_cause" ~ '^Pending\\.\\.\\. '`,
        );

        // Written on STARTING and left in place while the container ran.
        await queryRunner.query(
            `UPDATE "action"
             SET "state_cause_code" = CASE "state"
                     WHEN 'STARTING' THEN 'STARTING'
                     WHEN 'PROCESSING' THEN 'RUNNING'
                     WHEN 'STOPPING' THEN 'STOPPING'
                 END
             WHERE "state_cause" = 'Action is currently running...'`,
        );

        await queryRunner.query(
            `UPDATE "action" SET "state_cause_code" = 'SUBMITTED'
             WHERE "state" = 'PENDING' AND "state_cause_code" IS NULL`,
        );
    }

    /**
     * Earlier states were never recorded, so each existing action gets what is
     * known: when and by whom it was submitted, and its current state.
     */
    private async backfillHistory(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "action_state_transition"
                 ("actionUuid", "createdAt", "state", "causeCode", "actorUuid")
             SELECT "uuid", "createdAt", 'PENDING', 'SUBMITTED', "creatorUuid"
             FROM "action"`,
        );
        await queryRunner.query(
            `INSERT INTO "action_state_transition"
                 ("actionUuid", "createdAt", "state", "causeCode", "causeParams", "message")
             SELECT "uuid",
                    GREATEST("updatedAt", "createdAt" + interval '1 millisecond'),
                    "state"::text::"public"."action_state_transition_state_enum",
                    "state_cause_code",
                    "state_cause_params",
                    CASE WHEN "state_cause_code" IS NULL
                           OR "state_cause_code" = 'WAITING_FOR_RESOURCES'
                         THEN "state_cause" END
             FROM "action"
             WHERE "state_cause_code" IS DISTINCT FROM 'SUBMITTED'`,
        );
    }
}
