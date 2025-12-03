import { MigrationInterface, QueryRunner } from 'typeorm';

export class Test1764757646755 implements MigrationInterface {
    name = 'Test1764757646755';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" ADD "artifact_size" integer`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "artifact_files" json`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "artifact_files"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "artifact_size"`,
        );
    }
}
