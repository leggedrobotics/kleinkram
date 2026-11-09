import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileRecordingTimes1789212851248 implements MigrationInterface {
    name = 'AddFileRecordingTimes1789212851248';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "recordingStartDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "recordingEndDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "recordingTimesCheckedAt" TIMESTAMP`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "recordingTimesCheckedAt"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "recordingEndDate"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "recordingStartDate"`,
        );
    }
}
