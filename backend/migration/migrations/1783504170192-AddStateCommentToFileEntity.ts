import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStateCommentToFileEntity1783504170192 implements MigrationInterface {
    name = 'AddStateCommentToFileEntity1783504170192';

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
