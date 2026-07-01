import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanceledStateToFileStateEnum1782914752308 implements MigrationInterface {
    name = 'AddCanceledStateToFileStateEnum1782914752308';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."file_entity_state_enum" RENAME TO "file_entity_state_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_state_enum" AS ENUM('OK', 'CORRUPTED', 'UPLOADING', 'ERROR', 'CONVERTING', 'CONVERSION_ERROR', 'LOST', 'FOUND', 'CANCELED')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" TYPE "public"."file_entity_state_enum" USING "state"::"text"::"public"."file_entity_state_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" SET DEFAULT 'OK'`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."file_entity_state_enum_old"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_state_enum_old" AS ENUM('OK', 'CORRUPTED', 'UPLOADING', 'ERROR', 'CONVERTING', 'CONVERSION_ERROR', 'LOST', 'FOUND')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" TYPE "public"."file_entity_state_enum_old" USING "state"::"text"::"public"."file_entity_state_enum_old"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ALTER COLUMN "state" SET DEFAULT 'OK'`,
        );
        await queryRunner.query(`DROP TYPE "public"."file_entity_state_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."file_entity_state_enum_old" RENAME TO "file_entity_state_enum"`,
        );
    }
}
