import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSystemUserUuid1769000000000 implements MigrationInterface {
    name = 'UpdateSystemUserUuid1769000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const oldUuid = '10000000-0000-0000-0000-000000000000';
        const newUuid = '00000000-0000-4000-8000-000000000000';

        await queryRunner.query(`SET session_replication_role = 'replica'`);

        try {
            // Update User table
            await queryRunner.query(
                `UPDATE "user" SET "uuid" = '${newUuid}' WHERE "uuid" = '${oldUuid}'`,
            );

            // Update referencing tables
            const tables = [
                { name: 'action', column: 'creatorUuid' },
                { name: 'action_template', column: 'creatorUuid' },
                { name: 'mission', column: 'creatorUuid' },
                { name: 'project', column: 'creatorUuid' },
                { name: 'category', column: 'creatorUuid' },
                { name: 'group_membership', column: 'userUuid' },
                { name: 'tag', column: 'creatorUuid' },
                { name: 'access_group', column: 'creatorUuid' },
                { name: 'file_entity', column: 'creatorUuid' },
            ];

            for (const table of tables) {
                await queryRunner.query(
                    `UPDATE "${table.name}" SET "${table.column}" = '${newUuid}' WHERE "${table.column}" = '${oldUuid}'`,
                );
            }
        } finally {
            await queryRunner.query(`SET session_replication_role = 'origin'`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const oldUuid = '10000000-0000-0000-0000-000000000000';
        const newUuid = '00000000-0000-4000-8000-000000000000';

        await queryRunner.query(`SET session_replication_role = 'replica'`);

        try {
            const tables = [
                { name: 'action', column: 'creatorUuid' },
                { name: 'action_template', column: 'creatorUuid' },
                { name: 'mission', column: 'creatorUuid' },
                { name: 'project', column: 'creatorUuid' },
                { name: 'category', column: 'creatorUuid' },
                { name: 'group_membership', column: 'userUuid' },
                { name: 'tag', column: 'creatorUuid' },
                { name: 'access_group', column: 'creatorUuid' },
                { name: 'file_entity', column: 'creatorUuid' },
            ];

            for (const table of tables) {
                await queryRunner.query(
                    `UPDATE "${table.name}" SET "${table.column}" = '${oldUuid}' WHERE "${table.column}" = '${newUuid}'`,
                );
            }

            await queryRunner.query(
                `UPDATE "user" SET "uuid" = '${oldUuid}' WHERE "uuid" = '${newUuid}'`,
            );
        } finally {
            await queryRunner.query(`SET session_replication_role = 'origin'`);
        }
    }
}
