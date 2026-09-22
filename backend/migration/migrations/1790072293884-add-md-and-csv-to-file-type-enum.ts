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
