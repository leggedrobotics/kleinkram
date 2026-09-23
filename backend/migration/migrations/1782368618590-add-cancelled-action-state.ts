import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledActionState1782368618590 implements MigrationInterface {
    name = 'AddCancelledActionState1782368618590';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."action_state_enum" RENAME TO "action_state_enum_old"`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_state_enum" AS ENUM('PENDING', 'STARTING', 'PROCESSING', 'STOPPING', 'DONE', 'FAILED', 'UNPROCESSABLE', 'CANCELLED')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ALTER COLUMN "state" TYPE "public"."action_state_enum" USING "state"::"text"::"public"."action_state_enum"`,
        );
        await queryRunner.query(`DROP TYPE "public"."action_state_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."action_state_enum_old" AS ENUM('PENDING', 'STARTING', 'PROCESSING', 'STOPPING', 'DONE', 'FAILED', 'UNPROCESSABLE')`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ALTER COLUMN "state" TYPE "public"."action_state_enum_old" USING "state"::"text"::"public"."action_state_enum_old"`,
        );
        await queryRunner.query(`DROP TYPE "public"."action_state_enum"`);
        await queryRunner.query(
            `ALTER TYPE "public"."action_state_enum_old" RENAME TO "action_state_enum"`,
        );
    }
}
