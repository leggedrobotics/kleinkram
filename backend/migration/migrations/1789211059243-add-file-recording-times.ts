import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileRecordingTimes1789211059243 implements MigrationInterface {
    name = 'AddFileRecordingTimes1789211059243';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "recordingStartDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "recordingEndDate" TIMESTAMP`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "recordingEndDate"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "recordingStartDate"`,
        );
    }
}
