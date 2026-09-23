import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the legacy `tag` / `tag_type` tables to `metadata` /
 * `metadata_type` (issue #890).
 *
 * Hand-written: TypeORM would create empty tables next to the old ones.
 * Everything is renamed in place instead, to the names TypeORM derives for
 * the renamed entities, so no data moves.
 */
export class RenameTagsToMetadata1790185600822 implements MigrationInterface {
    name = 'RenameTagsToMetadata1790185600822';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "tag_type" RENAME TO "metadata_type"`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."tag_type_datatype_enum" RENAME TO "metadata_type_datatype_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type" RENAME CONSTRAINT "PK_92bf1776a059ea820f934bf2046" TO "PK_b5044096c19ba70a00d109af86f"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_8102188b489ccc9e092d7c177b" RENAME TO "IDX_16718ff55e2c3ebfd2e74b0156"`,
        );
        await queryRunner.query(`ALTER TABLE "tag" RENAME TO "metadata"`);
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME COLUMN "tagTypeUuid" TO "metadataTypeUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "PK_d70de2c1e1a3b52adb904028ea2" TO "PK_aa79e608e645db5756f0ef3b046"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_be048a4c67f6daafd6735543c18" TO "FK_4e223378ab2519d68f8bbeb7b2e"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_5d69bfb6df54eb228617b29afda" TO "FK_7ced83deba11269883d86aa7ceb"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_9857972d0bb698a79a9a9e1497f" TO "FK_ae887399d71c20ad7928580ac7b"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_16daeaa9a7c1eeeb4468048d21" RENAME TO "IDX_086d8e333591bea3784cbe372c"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" RENAME TO "metadata_type_projects_project"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME COLUMN "tagTypeUuid" TO "metadataTypeUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "PK_40fa37b8e026b9367654ed0d91a" TO "PK_be034e1437943f2c3490487e8e7"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "FK_680533992be5f8a6d5664f1efa0" TO "FK_73bb2002ab8c2ba8dc7aa14679e"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "FK_524b6f4291e81c3f9292f044399" TO "FK_e423fdd0306df87f53849ae4be5"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_680533992be5f8a6d5664f1efa" RENAME TO "IDX_73bb2002ab8c2ba8dc7aa14679"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_524b6f4291e81c3f9292f04439" RENAME TO "IDX_e423fdd0306df87f53849ae4be"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_e423fdd0306df87f53849ae4be" RENAME TO "IDX_524b6f4291e81c3f9292f04439"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_73bb2002ab8c2ba8dc7aa14679" RENAME TO "IDX_680533992be5f8a6d5664f1efa"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "FK_e423fdd0306df87f53849ae4be5" TO "FK_524b6f4291e81c3f9292f044399"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "FK_73bb2002ab8c2ba8dc7aa14679e" TO "FK_680533992be5f8a6d5664f1efa0"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME CONSTRAINT "PK_be034e1437943f2c3490487e8e7" TO "PK_40fa37b8e026b9367654ed0d91a"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME COLUMN "metadataTypeUuid" TO "tagTypeUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type_projects_project" RENAME TO "tag_type_project_project"`,
        );
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_086d8e333591bea3784cbe372c" RENAME TO "IDX_16daeaa9a7c1eeeb4468048d21"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_ae887399d71c20ad7928580ac7b" TO "FK_9857972d0bb698a79a9a9e1497f"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_7ced83deba11269883d86aa7ceb" TO "FK_5d69bfb6df54eb228617b29afda"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "FK_4e223378ab2519d68f8bbeb7b2e" TO "FK_be048a4c67f6daafd6735543c18"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME CONSTRAINT "PK_aa79e608e645db5756f0ef3b046" TO "PK_d70de2c1e1a3b52adb904028ea2"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata" RENAME COLUMN "metadataTypeUuid" TO "tagTypeUuid"`,
        );
        await queryRunner.query(`ALTER TABLE "metadata" RENAME TO "tag"`);
        await queryRunner.query(
            `ALTER INDEX "public"."IDX_16718ff55e2c3ebfd2e74b0156" RENAME TO "IDX_8102188b489ccc9e092d7c177b"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type" RENAME CONSTRAINT "PK_b5044096c19ba70a00d109af86f" TO "PK_92bf1776a059ea820f934bf2046"`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."metadata_type_datatype_enum" RENAME TO "tag_type_datatype_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "metadata_type" RENAME TO "tag_type"`,
        );
    }
}
