import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionStateIndex1769507204855 implements MigrationInterface {
    name = 'AddActionStateIndex1769507204855';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX "IDX_eee6559db4a29f48ad7b6cb1d2" ON "action" ("state") `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX "public"."IDX_eee6559db4a29f48ad7b6cb1d2"`,
        );
    }
}
