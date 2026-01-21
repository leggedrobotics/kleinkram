import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImproveActionExit1769003840300 implements MigrationInterface {
    name = 'ImproveActionExit1769003840300';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "action_runner" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "hostname" character varying NOT NULL, "version" character varying NOT NULL, "gitHash" character varying NOT NULL, "startedAt" TIMESTAMP NOT NULL, "lastSeenAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_7142c1ef313c280d5f666438263" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_352c56378e3f57ebfad9211f8e" ON "action_runner" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_errorhint_enum" AS ENUM('DOCKER_IMAGE_NOT_FOUND', 'CLI_OUTDATED', 'MEMORY_LIMIT_EXCEEDED')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "errorHint" "public"."action_errorhint_enum"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "errorHint"`);
        await queryRunner.query(`DROP TYPE "public"."action_errorhint_enum"`);
        await queryRunner.query(
            `DROP INDEX "public"."IDX_352c56378e3f57ebfad9211f8e"`,
        );
        await queryRunner.query(`DROP TABLE "action_runner"`);
    }
}
