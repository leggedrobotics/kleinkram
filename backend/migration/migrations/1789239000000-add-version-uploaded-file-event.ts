import { MigrationInterface, QueryRunner } from 'typeorm';

const EVENT_TYPES = [
    'CREATED',
    'DELETED',
    'UPLOAD_STARTED',
    'UPLOAD_COMPLETED',
    'TOPICS_EXTRACTED',
    'FILE_CONVERTED',
    'FILE_CONVERTED_FROM',
    'FOXGLOVE_URL_GENERATED',
    'DOWNLOADED',
    'RENAMED',
    'MOVED',
];

const asEnumLiteral = (values: string[]): string =>
    values.map((value) => `'${value}'`).join(', ');

export class AddVersionUploadedFileEvent1789239000000 implements MigrationInterface {
    name = 'AddVersionUploadedFileEvent1789239000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."file_event_type_enum" RENAME TO "file_event_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_event_type_enum" AS ENUM(${asEnumLiteral([...EVENT_TYPES, 'VERSION_UPLOADED'])})`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ALTER COLUMN "type" TYPE "public"."file_event_type_enum" USING "type"::"text"::"public"."file_event_type_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."file_event_type_enum_old"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Events of the dropped type have no equivalent in the old enum, so
        // they are removed rather than silently rewritten to another type.
        await queryRunner.query(
            `DELETE FROM "file_event" WHERE "type" = 'VERSION_UPLOADED'`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_event_type_enum_old" AS ENUM(${asEnumLiteral(EVENT_TYPES)})`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ALTER COLUMN "type" TYPE "public"."file_event_type_enum_old" USING "type"::"text"::"public"."file_event_type_enum_old"`,
        );
        await queryRunner.query(`DROP TYPE "public"."file_event_type_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."file_event_type_enum_old" RENAME TO "file_event_type_enum"`,
        );
    }
}
