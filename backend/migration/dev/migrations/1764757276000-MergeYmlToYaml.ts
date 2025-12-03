import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeYmlToYaml1764757276000 implements MigrationInterface {
    name = 'MergeYmlToYaml1764757276000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "file_entity" SET "type" = 'YAML' WHERE "type" = 'YML'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No operation for down as we cannot distinguish which were originally YML
    }
}
