import { MigrationInterface, QueryRunner } from 'typeorm';

export class IgnoreSoftDeletedWhileCheckingNameConstraints1769509296006 implements MigrationInterface {
    name = 'IgnoreSoftDeletedWhileCheckingNameConstraints1769509296006';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "mission" DROP CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT "unique_file_name_per_mission"`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" DROP CONSTRAINT "unique_category_name_per_project"`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" DROP CONSTRAINT "unique_mission_name_per_project"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP CONSTRAINT "unique_versioned_action_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" DROP CONSTRAINT "UQ_dedfea394088ed136ddadeee89c"`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" DROP CONSTRAINT "unique_access_group_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" DROP CONSTRAINT "UQ_e1a6e9c0229f80fc2604aa3dc61"`,
        );
        await queryRunner.query(
            `ALTER TABLE "worker" DROP CONSTRAINT "UQ_187e709b9ca210ebafd74e59746"`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_file_name_per_mission" ON "file_entity" ("filename", "missionUuid") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_category_name_per_project" ON "category" ("name", "projectUuid") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_project_name_active" ON "project" ("name") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_access_group_name" ON "access_group" ("name") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_mission_name_per_project" ON "mission" ("name", "projectUuid") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_apikey_active" ON "apikey" ("apikey") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_versioned_action_name" ON "action_template" ("name", "version") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_worker_identifier_active" ON "worker" ("identifier") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" ADD CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "mission" DROP CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_worker_identifier_active"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_versioned_action_name"`,
        );
        await queryRunner.query(`DROP INDEX "public"."unique_apikey_active"`);
        await queryRunner.query(
            `DROP INDEX "public"."unique_mission_name_per_project"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_access_group_name"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_project_name_active"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_category_name_per_project"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_file_name_per_mission"`,
        );
        await queryRunner.query(
            `ALTER TABLE "worker" ADD CONSTRAINT "UQ_187e709b9ca210ebafd74e59746" UNIQUE ("identifier")`,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" ADD CONSTRAINT "UQ_e1a6e9c0229f80fc2604aa3dc61" UNIQUE ("apikey")`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ADD CONSTRAINT "unique_access_group_name" UNIQUE ("name")`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" ADD CONSTRAINT "UQ_dedfea394088ed136ddadeee89c" UNIQUE ("name")`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD CONSTRAINT "unique_versioned_action_name" UNIQUE ("name", "version")`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" ADD CONSTRAINT "unique_mission_name_per_project" UNIQUE ("name", "projectUuid")`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" ADD CONSTRAINT "unique_category_name_per_project" UNIQUE ("name", "projectUuid")`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD CONSTRAINT "unique_file_name_per_mission" UNIQUE ("filename", "missionUuid")`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" ADD CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }
}
