import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryDescription1790078000000 implements MigrationInterface {
    name = 'AddCategoryDescription1790078000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "category" ADD "description" character varying NOT NULL DEFAULT ''`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "category" DROP COLUMN "description"`,
        );
    }
}
