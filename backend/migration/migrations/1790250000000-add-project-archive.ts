import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectArchive1790250000000 implements MigrationInterface {
    name = 'AddProjectArchive1790250000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."project_archivestate_enum" AS ENUM('ACTIVE', 'ARCHIVING', 'ARCHIVED', 'RESTORING')`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" ADD "archiveState" "public"."project_archivestate_enum" NOT NULL DEFAULT 'ACTIVE'`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."project_archive_state_enum" AS ENUM('QUEUED', 'PACKING', 'VERIFYING', 'AWAITING_SEAL', 'PURGING', 'ARCHIVED', 'RECALLING', 'UNPACKING', 'RESTORED', 'FAILED')`,
        );
        await queryRunner.query(
            `CREATE TABLE "project_archive" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "projectName" character varying NOT NULL, "state" "public"."project_archive_state_enum" NOT NULL DEFAULT 'QUEUED', "location" character varying NOT NULL, "plan" jsonb NOT NULL DEFAULT '[]', "parts" jsonb NOT NULL DEFAULT '[]', "attempts" integer NOT NULL DEFAULT '0', "partsDone" integer NOT NULL DEFAULT '0', "leaseOwner" character varying, "leaseUntil" TIMESTAMP, "fileCount" integer NOT NULL DEFAULT '0', "totalBytes" bigint NOT NULL DEFAULT '0', "bytesProcessed" bigint NOT NULL DEFAULT '0', "reason" text, "archivedAt" TIMESTAMP, "restoreReason" text, "restoreRequestedAt" TIMESTAMP, "restoredAt" TIMESTAMP, "error" text, "projectUuid" uuid, "requestedByUuid" uuid, "restoreRequestedByUuid" uuid, CONSTRAINT "PK_project_archive_uuid" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_1eee85077a1115e6ed713c6b22" ON "project_archive" ("deletedAt") `,
        );
        await queryRunner.query(
            `ALTER TABLE "project_archive" ADD CONSTRAINT "FK_ee2f7d71f4955a3b7769dc20f10" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_archive" ADD CONSTRAINT "FK_c170882e183628e8a1e5df0b8b8" FOREIGN KEY ("requestedByUuid") REFERENCES "user"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_archive" ADD CONSTRAINT "FK_6e576c23dee27fd0897d1a25914" FOREIGN KEY ("restoreRequestedByUuid") REFERENCES "user"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "project_archive" DROP CONSTRAINT "FK_6e576c23dee27fd0897d1a25914"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_archive" DROP CONSTRAINT "FK_c170882e183628e8a1e5df0b8b8"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_archive" DROP CONSTRAINT "FK_ee2f7d71f4955a3b7769dc20f10"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_1eee85077a1115e6ed713c6b22"`,
        );
        await queryRunner.query(`DROP TABLE "project_archive"`);
        await queryRunner.query(
            `DROP TYPE "public"."project_archive_state_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" DROP COLUMN "archiveState"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."project_archivestate_enum"`,
        );
    }
}
