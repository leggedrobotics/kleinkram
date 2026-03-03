import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateIngestionJobLocation1769507204860 implements MigrationInterface {
    name = 'UpdateIngestionJobLocation1769507204860';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DO $$
             BEGIN
                 IF EXISTS (
                     SELECT 1 FROM pg_enum e
                     JOIN pg_type t ON t.oid = e.enumtypid
                     WHERE t.typname = 'ingestion_job_location_enum'
                       AND e.enumlabel = 'MINIO'
                 ) THEN
                     ALTER TYPE "ingestion_job_location_enum" RENAME VALUE 'MINIO' TO 'S3';
                 END IF;
             END
             $$`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DO $$
             BEGIN
                 IF EXISTS (
                     SELECT 1 FROM pg_enum e
                     JOIN pg_type t ON t.oid = e.enumtypid
                     WHERE t.typname = 'ingestion_job_location_enum'
                       AND e.enumlabel = 'S3'
                 ) THEN
                     ALTER TYPE "ingestion_job_location_enum" RENAME VALUE 'S3' TO 'MINIO';
                 END IF;
             END
             $$`,
        );
    }
}
