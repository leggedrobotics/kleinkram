import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectStars1790077978542 implements MigrationInterface {
    name = 'AddProjectStars1790077978542';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "project_star" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userUuid" uuid NOT NULL, "projectUuid" uuid NOT NULL, CONSTRAINT "PK_e4764fed71729673a7269c88af9" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_5060dc319809ee95272cdfc160" ON "project_star"  ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "unique_project_star_per_user" ON "project_star"  ("userUuid", "projectUuid") WHERE "deletedAt" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_star" ADD CONSTRAINT "FK_9448383b669520e223da976db1c" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_star" ADD CONSTRAINT "FK_ebe99938d0f467077ca05d94a82" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "project_star" DROP CONSTRAINT "FK_ebe99938d0f467077ca05d94a82"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_star" DROP CONSTRAINT "FK_9448383b669520e223da976db1c"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."unique_project_star_per_user"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_5060dc319809ee95272cdfc160"`,
        );
        await queryRunner.query(`DROP TABLE "project_star"`);
    }
}
