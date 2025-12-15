import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AffiliationGroupService } from '@backend-common/services/affiliation-group.service';
import { AccessGroupConfig } from '@kleinkram/shared';
import * as fs from 'node:fs';

import { systemUser } from '@backend-common/consts';
import path from 'node:path';
import { Connection, Not } from 'typeorm';
import { Factory, Seeder } from 'typeorm-seeding';
import { seedActionTemplates } from './seed-action-templates';
import { seedFiles } from './seed-files';
import { seedProjects } from './seed-projects';
import { seedUsers } from './seed-users';

export default class CreateUsers implements Seeder {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    public async run(factory: Factory, conn: Connection): Promise<void> {
        if (!process.env.SEED || process.env.SEED !== 'true') {
            // eslint-disable-next-line no-console
            console.log('Skipping seeding (SEED env var not set to true)');
            return;
        }

        const userCount = await conn.getRepository(UserEntity).count({
            where: { uuid: Not(systemUser.uuid) },
        });
        if (userCount > 0) {
            // eslint-disable-next-line no-console
            console.log('Users exist in DB, skipping seeding.');
            return;
        }

        // eslint-disable-next-line no-console
        console.log('\n\n »» Seeding Users and Data...\n\n');

        // Create Access Groups first
        const accessGroupRepository = conn.getRepository(AccessGroupEntity);
        const groupMembershipRepository = conn.getRepository(
            GroupMembershipEntity,
        );
        const affiliationGroupService = new AffiliationGroupService(
            accessGroupRepository,
            groupMembershipRepository,
        );

        // Load config
        const configPath = path.resolve(
            // eslint-disable-next-line unicorn/prefer-module
            __dirname,
            '../../../../../backend/src/access_config.json',
        );
        let config: AccessGroupConfig | undefined;

        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(configContent) as AccessGroupConfig;
                await affiliationGroupService.createAccessGroups(config);
            } catch (error: unknown) {
                console.error(
                    'Error loading or parsing access_config.json:',
                    error,
                );
            }
        } else {
            console.warn(`Access config not found at ${configPath}`);
        }

        const { adminUser, internalUser } = await seedUsers(
            factory,
            conn,
            affiliationGroupService,
            config,
        );

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
