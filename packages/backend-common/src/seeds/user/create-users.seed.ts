import { UserEntity } from '@backend-common/entities/user/user.entity';
import { seedActionTemplates } from '@backend-common/seeds/user/seed-action-templates';
import { seedFiles } from '@backend-common/seeds/user/seed-files';
import { seedProjects } from '@backend-common/seeds/user/seed-projects';
import { seedUsers } from '@backend-common/seeds/user/seed-users';
import { Connection } from 'typeorm';
import { Factory, Seeder } from 'typeorm-seeding';

export default class CreateUsers implements Seeder {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    public async run(factory: Factory, conn: Connection): Promise<void> {
        if (!process.env.SEED || process.env.SEED !== 'true') {
            // eslint-disable-next-line no-console
            console.log('Skipping seeding (SEED env var not set to true)');
            return;
        }

        // Check if admin user already exists
        const existingAdmin = await conn.getRepository(UserEntity).findOne({
            where: { email: 'admin@kleinkram.dev' },
        });

        if (existingAdmin) {
            // eslint-disable-next-line no-console
            console.log('Seeding already done, skipping...');
            return;
        }

        // eslint-disable-next-line no-console
        console.log('\n\n »» Seeding Users and Data...\n\n');

        const { adminUser, internalUser } = await seedUsers(factory, conn);

        const { createdMissions, tagTypes } = await seedProjects(
            factory,
            conn,
            adminUser,
            internalUser,
        );

        await seedActionTemplates(conn, adminUser);

        await seedFiles(factory, conn, adminUser, createdMissions, tagTypes);
    }
}
