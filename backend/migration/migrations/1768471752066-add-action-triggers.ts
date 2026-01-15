import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionTriggers1768471752066 implements MigrationInterface {
    name = 'AddActionTriggers1768471752066';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."action_trigger_type_enum" AS ENUM('WEBHOOK', 'TIME', 'FILE')`,
        );
        await queryRunner.query(
            `CREATE TABLE "action_trigger" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "description" character varying NOT NULL, "templateUuid" uuid NOT NULL, "missionUuid" uuid NOT NULL, "type" "public"."action_trigger_type_enum" NOT NULL, "config" json NOT NULL, CONSTRAINT "PK_164ded32e8a5daf2d90f5fdeff6" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_f31516104db085a67c4cb5a90e" ON "action_trigger" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_triggersource_enum" AS ENUM('MANUAL', 'CRON', 'WEBHOOK', 'FILE_EVENT')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD "triggerSource" "public"."action_triggersource_enum" NOT NULL DEFAULT 'MANUAL'`,
        );
        await queryRunner.query(`ALTER TABLE "action" ADD "triggerUuid" uuid`);
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_c2c8d7cd33045a682b4725fbaf0" FOREIGN KEY ("templateUuid") REFERENCES "action_template"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_dbfcd510d391a89e096047f75ad" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_f48b32e71e879db6cfcbf0915de" FOREIGN KEY ("triggerUuid") REFERENCES "action_trigger"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_f48b32e71e879db6cfcbf0915de"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT "FK_dbfcd510d391a89e096047f75ad"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT "FK_c2c8d7cd33045a682b4725fbaf0"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "triggerUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "triggerSource"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."action_triggersource_enum"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_f31516104db085a67c4cb5a90e"`,
        );
        await queryRunner.query(`DROP TABLE "action_trigger"`);
        await queryRunner.query(
            `DROP TYPE "public"."action_trigger_type_enum"`,
        );
    }
}
