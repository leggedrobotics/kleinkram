import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileStateComment1790177984209 implements MigrationInterface {
    name = 'AddFileStateComment1790177984209';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD "stateComment" text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "stateComment"`,
        );
    }
}
