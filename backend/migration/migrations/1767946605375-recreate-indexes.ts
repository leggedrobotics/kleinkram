import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecreateIndexes1767946605375 implements MigrationInterface {
    name = 'RecreateIndexes1767946605375';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX "public"."IDX_cff24fb6f37558b50778134d28"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_6d71c0142267fbeaba6cae0e5d"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX "IDX_6d71c0142267fbeaba6cae0e5d" ON "mission" ("projectUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_cff24fb6f37558b50778134d28" ON "file_entity" ("missionUuid") `,
        );
    }
}
