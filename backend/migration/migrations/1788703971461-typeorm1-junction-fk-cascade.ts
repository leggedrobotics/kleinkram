import { MigrationInterface, QueryRunner } from 'typeorm';

export class Typeorm1JunctionFkCascade1788703971461 implements MigrationInterface {
    name = 'Typeorm1JunctionFkCascade1788703971461';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" DROP CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" DROP CONSTRAINT "FK_524b6f4291e81c3f9292f044399"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" ADD CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6" FOREIGN KEY ("categoryUuid") REFERENCES "category"("uuid") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" ADD CONSTRAINT "FK_524b6f4291e81c3f9292f044399" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" DROP CONSTRAINT "FK_524b6f4291e81c3f9292f044399"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" DROP CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" ADD CONSTRAINT "FK_524b6f4291e81c3f9292f044399" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" ADD CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6" FOREIGN KEY ("categoryUuid") REFERENCES "category"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }
}
