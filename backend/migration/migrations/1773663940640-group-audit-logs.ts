import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupAuditLogs1773663940640 implements MigrationInterface {
    name = 'GroupAuditLogs1773663940640';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_event_type_enum" AS ENUM('CREATE_GROUP', 'ADD_USER', 'REMOVE_USER', 'UPDATE_EXPIRE_DATE', 'ADD_PROJECT', 'REMOVE_PROJECT', 'UPDATE_PROJECT_ACCESS')`,
        );
        await queryRunner.query(
            `CREATE TABLE "access_group_event" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."access_group_event_type_enum" NOT NULL, "details" jsonb NOT NULL DEFAULT '{}', "actorUuid" uuid, "accessGroupUuid" uuid NOT NULL, CONSTRAINT "PK_7caa643da96a40e4ae075115db0" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_20370d0ed93a530bd8c30fa06d" ON "access_group_event" ("accessGroupUuid") `,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group_event" ADD CONSTRAINT "FK_809d4e34b0efeb860f33d6f4390" FOREIGN KEY ("actorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group_event" ADD CONSTRAINT "FK_20370d0ed93a530bd8c30fa06df" FOREIGN KEY ("accessGroupUuid") REFERENCES "access_group"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "access_group_event" DROP CONSTRAINT "FK_20370d0ed93a530bd8c30fa06df"`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group_event" DROP CONSTRAINT "FK_809d4e34b0efeb860f33d6f4390"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_20370d0ed93a530bd8c30fa06d"`,
        );
        await queryRunner.query(`DROP TABLE "access_group_event"`);
        await queryRunner.query(
            `DROP TYPE "public"."access_group_event_type_enum"`,
        );
    }
}
