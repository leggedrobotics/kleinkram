import { MigrationInterface, QueryRunner } from 'typeorm';

export class BindTriggerToUser1768828521788 implements MigrationInterface {
    name = 'BindTriggerToUser1768828521788';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD "creatorUuid" uuid NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" ADD CONSTRAINT "FK_8e9efad2634d1bc33e77a694804" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP CONSTRAINT "FK_8e9efad2634d1bc33e77a694804"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_trigger" DROP COLUMN "creatorUuid"`,
        );
    }
}
