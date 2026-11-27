import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogToFileTypeEnum1795773218765 implements MigrationInterface {
    name = 'AddLogToFileTypeEnum1795773218765';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."file_entity_type_enum" RENAME TO "file_entity_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_type_enum" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'MD', 'CSV', 'LOG', 'ALL')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "type" TYPE "public"."file_entity_type_enum" USING "type"::"text"::"public"."file_entity_type_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."file_entity_type_enum_old"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The previous enum has no LOG member, so the cast below would fail
        // with an opaque Postgres error once such files exist. Refuse with an
        // actionable message instead; deleting uploads is the operator's call.
        // Soft-deleted rows count too, they still hold the value.
        const [blocking]: { count: string }[] = await queryRunner.query(
            `SELECT COUNT(*)::text AS count FROM "file_entity" WHERE "type" = 'LOG'`,
        );
        const blockingCount = Number(blocking?.count ?? '0');
        if (blockingCount > 0) {
            throw new Error(
                `Cannot revert ${this.name}: ${String(blockingCount)} file(s) are typed LOG, ` +
                    `which the previous file_entity_type_enum cannot store. Remove or ` +
                    `convert those files first, then retry the rollback.`,
            );
        }

        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_type_enum_old" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'MD', 'CSV', 'ALL')`,
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
