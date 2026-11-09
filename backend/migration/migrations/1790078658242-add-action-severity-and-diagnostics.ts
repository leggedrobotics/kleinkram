import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionSeverityAndDiagnostics1790078658242 implements MigrationInterface {
    name = 'AddActionSeverityAndDiagnostics1790078658242';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."action_diagnostic_severity_enum" AS ENUM('INFO', 'WARNING', 'ERROR')`,
        );
        await queryRunner.query(
            `CREATE TABLE "action_diagnostic" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "severity" "public"."action_diagnostic_severity_enum" NOT NULL, "message" character varying(500) NOT NULL, "code" character varying(64), "file" character varying(1024), "count" integer NOT NULL DEFAULT '1', "details" jsonb, "actionUuid" uuid NOT NULL, CONSTRAINT "PK_a5b4cf494c52b68dec7ad356769" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_763b5d2b8c75a0346d7ec11826" ON "action_diagnostic"  ("actionUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_action_diagnostic_dedup" ON "action_diagnostic"  ("actionUuid", "severity", "code", "file") `,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_severity_enum" AS ENUM('OK', 'WARNING', 'ERROR')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "severity" "public"."action_severity_enum" NOT NULL DEFAULT 'OK'`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_failureorigin_enum" AS ENUM('USER', 'SYSTEM')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "failureOrigin" "public"."action_failureorigin_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "diagnosticCount" integer NOT NULL DEFAULT '0'`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "diagnosticsTruncated" boolean NOT NULL DEFAULT false`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_8e36c78c3767cc239e0373c081" ON "action"  ("severity") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_6a746776e7543870c2be23e015" ON "action"  ("failureOrigin") `,
        );
        await queryRunner.query(
            `ALTER TABLE "action_diagnostic" ADD CONSTRAINT "FK_763b5d2b8c75a0346d7ec118261" FOREIGN KEY ("actionUuid") REFERENCES "action"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );

        // Historical actions that already failed are errors by definition, so
        // their verdict can be derived rather than left at the OK default.
        // `failureOrigin` is deliberately not backfilled: for past runs it
        // would be a guess, and null renders as plain "Failed" exactly as before.
        await queryRunner.query(
            `UPDATE "action" SET "severity" = 'ERROR' WHERE "state" IN ('FAILED', 'UNPROCESSABLE')`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_diagnostic" DROP CONSTRAINT "FK_763b5d2b8c75a0346d7ec118261"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_6a746776e7543870c2be23e015"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_8e36c78c3767cc239e0373c081"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "diagnosticsTruncated"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "diagnosticCount"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "failureOrigin"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."action_failureorigin_enum"`,
        );
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "severity"`);
        await queryRunner.query(`DROP TYPE "public"."action_severity_enum"`);
        await queryRunner.query(
            `DROP INDEX "public"."idx_action_diagnostic_dedup"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_763b5d2b8c75a0346d7ec11826"`,
        );
        await queryRunner.query(`DROP TABLE "action_diagnostic"`);
        await queryRunner.query(
            `DROP TYPE "public"."action_diagnostic_severity_enum"`,
        );
    }
}
