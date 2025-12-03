import { MigrationInterface, QueryRunner } from 'typeorm';

export class Test1764757678018 implements MigrationInterface {
    name = 'Test1764757678018';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "searchable"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "artifact_size" integer`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "artifact_files" json`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "description" character varying NOT NULL DEFAULT ''`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "isArchived" boolean NOT NULL DEFAULT false`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD "actionUuid" uuid`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."file_event_type_enum" RENAME TO "file_event_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_event_type_enum" AS ENUM('CREATED', 'DELETED', 'UPLOAD_STARTED', 'UPLOAD_COMPLETED', 'TOPICS_EXTRACTED', 'FILE_CONVERTED', 'FILE_CONVERTED_FROM', 'FOXGLOVE_URL_GENERATED', 'DOWNLOADED', 'RENAMED', 'MOVED')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ALTER COLUMN "type" TYPE "public"."file_event_type_enum" USING "type"::"text"::"public"."file_event_type_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."file_event_type_enum_old"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD CONSTRAINT "FK_2238e243c3519db9e8931704b23" FOREIGN KEY ("actionUuid") REFERENCES "action"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT "FK_2238e243c3519db9e8931704b23"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_event_type_enum_old" AS ENUM('CREATED', 'DELETED', 'UPLOAD_STARTED', 'UPLOAD_COMPLETED', 'TOPICS_EXTRACTED', 'FILE_CONVERTED', 'FILE_CONVERTED_FROM', 'DOWNLOADED', 'RENAMED', 'MOVED')`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ALTER COLUMN "type" TYPE "public"."file_event_type_enum_old" USING "type"::"text"::"public"."file_event_type_enum_old"`,
        );
        await queryRunner.query(`DROP TYPE "public"."file_event_type_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."file_event_type_enum_old" RENAME TO "file_event_type_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP COLUMN "actionUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "isArchived"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "description"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "artifact_files"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "artifact_size"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "searchable" boolean NOT NULL DEFAULT false`,
        );
    }
}
