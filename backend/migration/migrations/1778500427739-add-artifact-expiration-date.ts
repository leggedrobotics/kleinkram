import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArtifactExpirationDate1778500427739 implements MigrationInterface {
    name = 'AddArtifactExpirationDate1778500427739';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" ADD "artifactExpirationDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."action_artifacts_enum" ADD VALUE '50'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action" DROP COLUMN "artifactExpirationDate"`,
        );
    }
}
