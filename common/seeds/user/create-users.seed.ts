import { Connection } from 'typeorm';
import { Factory, Seeder } from 'typeorm-seeding';
import { seedActionTemplates } from './seed-action-templates';
import { seedFiles } from './seed-files';
import { seedProjects } from './seed-projects';
import { seedUsers } from './seed-users';

export default class CreateUsers implements Seeder {
    public async run(factory: Factory, conn: Connection): Promise<void> {
        if (!process.env['SEED'] || process.env['SEED'] !== 'true') {
            console.log('Skipping seeding (SEED env var not set to true)');
            return;
        }

        console.log('\n\n »» Seeding Users and Data...\n\n');

        // 1. Create Users
        const { adminUser, internalUser } = await seedUsers(factory, conn);

        // 2. Create Projects and Missions
        const { createdMissions, tagTypes } = await seedProjects(
            factory,
            conn,
            adminUser,
            internalUser,
        );

        // 3. Create Action Templates
        await seedActionTemplates(conn, adminUser);

        // 4. Generate and Upload Data
        await seedFiles(factory, conn, adminUser, createdMissions, tagTypes);
    }
}
