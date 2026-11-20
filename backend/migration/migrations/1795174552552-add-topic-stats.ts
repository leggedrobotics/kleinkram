import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTopicStats1795174552552 implements MigrationInterface {
    name = 'AddTopicStats1795174552552';

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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "topicStatsVersion"`,
        );
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "coverage"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "chunkCount"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "lastSeen"`);
        await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "firstSeen"`);
    }
}
