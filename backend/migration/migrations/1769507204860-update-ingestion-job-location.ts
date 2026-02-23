import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateIngestionJobLocation1769507204860 implements MigrationInterface {
    name = 'UpdateIngestionJobLocation1769507204860';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "ingestion_job" SET "location" = 'S3' WHERE "location" = 'MINIO'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "ingestion_job" SET "location" = 'MINIO' WHERE "location" = 'S3'`,
        );
    }
}
