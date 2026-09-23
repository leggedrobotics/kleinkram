import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromoteDemoteToAccessGroupEvent1778504645764 implements MigrationInterface {
    name = 'AddPromoteDemoteToAccessGroupEvent1778504645764';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."access_group_event_type_enum" RENAME TO "access_group_event_type_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_event_type_enum" AS ENUM('CREATE_GROUP', 'ADD_USER', 'REMOVE_USER', 'UPDATE_EXPIRE_DATE', 'ADD_PROJECT', 'REMOVE_PROJECT', 'UPDATE_PROJECT_ACCESS', 'PROMOTE_USER', 'DEMOTE_USER')`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group_event" ALTER COLUMN "type" TYPE "public"."access_group_event_type_enum" USING "type"::"text"::"public"."access_group_event_type_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."access_group_event_type_enum_old"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_event_type_enum_old" AS ENUM('CREATE_GROUP', 'ADD_USER', 'REMOVE_USER', 'UPDATE_EXPIRE_DATE', 'ADD_PROJECT', 'REMOVE_PROJECT', 'UPDATE_PROJECT_ACCESS')`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group_event" ALTER COLUMN "type" TYPE "public"."access_group_event_type_enum_old" USING "type"::"text"::"public"."access_group_event_type_enum_old"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."access_group_event_type_enum"`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."access_group_event_type_enum_old" RENAME TO "access_group_event_type_enum"`,
        );
    }
}
