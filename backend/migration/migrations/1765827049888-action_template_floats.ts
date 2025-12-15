import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionTemplateFloats1765827049888 implements MigrationInterface {
    name = 'ActionTemplateFloats1765827049888';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_template" ALTER COLUMN "cpuCores" TYPE double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ALTER COLUMN "cpuMemory" TYPE double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ALTER COLUMN "gpuMemory" TYPE double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ALTER COLUMN "maxRuntime" TYPE double precision`,
        );

        // Worker memory floats
        // cpuMemory
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker' AND column_name='cpuMemory') THEN
                    ALTER TABLE "worker" ALTER COLUMN "cpuMemory" TYPE double precision;
                ELSE
                    ALTER TABLE "worker" ADD COLUMN "cpuMemory" double precision NOT NULL DEFAULT 512;
                END IF;
            END $$;
        `);

        // gpuMemory
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker' AND column_name='gpuMemory') THEN
                    ALTER TABLE "worker" ALTER COLUMN "gpuMemory" TYPE double precision;
                ELSE
                    ALTER TABLE "worker" ADD COLUMN "gpuMemory" double precision NOT NULL DEFAULT -1;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "maxRuntime"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "maxRuntime" integer NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "gpuMemory"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "gpuMemory" integer NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "cpuMemory"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "cpuMemory" integer NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP COLUMN "cpuCores"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD "cpuCores" integer NOT NULL`,
        );

        // Revert worker memory to integer (might fail if data is not integer, but this is best effort reversion)
        await queryRunner.query(
            `ALTER TABLE "worker" ALTER COLUMN "cpuMemory" TYPE integer`,
        );
        await queryRunner.query(
            `ALTER TABLE "worker" ALTER COLUMN "gpuMemory" TYPE integer`,
        );
    }
}
