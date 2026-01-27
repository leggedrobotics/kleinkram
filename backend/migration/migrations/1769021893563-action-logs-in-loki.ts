import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionLogsInLoki1769021893563 implements MigrationInterface {
    name = 'ActionLogsInLoki1769021893563';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "logs"`);
        await queryRunner.query(
            `ALTER TABLE "action" ADD "resourceUsage" json`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "maxMemoryBytes" bigint`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "avgCpuPercent" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "efficiencyScore" double precision`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "efficiencyScore"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "avgCpuPercent"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "maxMemoryBytes"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "resourceUsage"`,
        );
        await queryRunner.query(`ALTER TABLE "action" ADD "logs" json`);
    }
}
