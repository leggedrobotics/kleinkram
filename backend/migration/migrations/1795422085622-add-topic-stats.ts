import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTopicStats1795422085622 implements MigrationInterface {
    name = 'AddTopicStats1795422085622';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "topic" ADD "firstSeen" TIMESTAMP WITH TIME ZONE`,
        );
        await queryRunner.query(
            `ALTER TABLE "topic" ADD "lastSeen" TIMESTAMP WITH TIME ZONE`,
        );
        await queryRunner.query(`ALTER TABLE "topic" ADD "chunkCount" integer`);
        await queryRunner.query(`ALTER TABLE "topic" ADD "coverage" jsonb`);
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "topicStatsVersion" integer NOT NULL DEFAULT '0'`,
        );
        await queryRunner.query(
            `ALTER TABLE "topic" ALTER COLUMN "frequency" DROP NOT NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Topics without a rate hold NULL; the old schema had 0 for those.
        await queryRunner.query(
            `UPDATE "topic" SET "frequency" = 0 WHERE "frequency" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "topic" ALTER COLUMN "frequency" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "topicStatsVersion"`,
        );
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "coverage"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "chunkCount"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "lastSeen"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "firstSeen"`);
    }
}
