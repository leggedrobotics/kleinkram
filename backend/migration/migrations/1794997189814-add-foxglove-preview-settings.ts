import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoxglovePreviewSettings1794997189814 implements MigrationInterface {
    name = 'AddFoxglovePreviewSettings1794997189814';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "system_setting" ("key" character varying(64) NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c6ce0e35b3c0d67dca93523ba1b" PRIMARY KEY ("key"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" ADD "foxglovePreviewEnabled" boolean NOT NULL DEFAULT true`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "project" DROP COLUMN "foxglovePreviewEnabled"`,
        );
        await queryRunner.query(`DROP TABLE "system_setting"`);
    }
}
