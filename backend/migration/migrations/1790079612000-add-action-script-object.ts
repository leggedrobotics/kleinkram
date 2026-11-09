import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionScriptObject1790079612000 implements MigrationInterface {
    name = 'AddActionScriptObject1790079612000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" ADD "scriptObject" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "maxRuntimeHours" double precision`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "maxRuntimeHours"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "scriptObject"`,
        );
    }
}
