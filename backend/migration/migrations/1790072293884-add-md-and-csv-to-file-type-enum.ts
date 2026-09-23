import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMdAndCsvToFileTypeEnum1790072293884 implements MigrationInterface {
    name = 'AddMdAndCsvToFileTypeEnum1790072293884';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."file_entity_type_enum" RENAME TO "file_entity_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_type_enum" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'MD', 'CSV', 'ALL')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "type" TYPE "public"."file_entity_type_enum" USING "type"::"text"::"public"."file_entity_type_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."file_entity_type_enum_old"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The previous enum has no MD or CSV member, so the cast below fails
        // with an opaque Postgres error once such files exist. Refuse up front
        // with an actionable message instead: deleting uploaded files (and the
        // storage objects behind them) is the operator's call, not something a
        // rollback should do silently. Soft-deleted rows count too, they still
        // hold the value the column is cast from.
        const [blocking]: { count: string }[] = await queryRunner.query(
            `SELECT COUNT(*)::text AS count FROM "file_entity" WHERE "type" IN ('MD', 'CSV')`,
        );
        const blockingCount = Number(blocking?.count ?? '0');
        if (blockingCount > 0) {
            throw new Error(
                `Cannot revert ${this.name}: ${blockingCount} file(s) are typed MD or CSV, ` +
                    `which the previous file_entity_type_enum cannot store. Remove or ` +
                    `convert those files first, then retry the rollback.`,
            );
        }

        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_type_enum_old" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'ALL')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "type" TYPE "public"."file_entity_type_enum_old" USING "type"::"text"::"public"."file_entity_type_enum_old"`,
        );
        await queryRunner.query(`DROP TYPE "public"."file_entity_type_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."file_entity_type_enum_old" RENAME TO "file_entity_type_enum"`,
        );
    }
}
