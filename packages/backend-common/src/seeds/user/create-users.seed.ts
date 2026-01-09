import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AffiliationGroupService } from '@backend-common/services/affiliation-group.service';
import { AccessGroupConfig } from '@kleinkram/shared';
import * as fs from 'node:fs';

import { systemUser } from '@backend-common/consts';
import path from 'node:path';
import { DataSource, Not } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { seedActionTemplates } from './seed-action-templates';
import { seedFiles } from './seed-files';
import { seedProjects } from './seed-projects';
import { seedUsers } from './seed-users';

export default class CreateUsers implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager,
    ): Promise<void> {
        if (!process.env.SEED || process.env.SEED !== 'true') {
            // eslint-disable-next-line no-console
            console.log('Skipping seeding (SEED env var not set to true)');
            return;
        }

        const userCount = await dataSource.getRepository(UserEntity).count({
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
        const accessGroupRepository =
            dataSource.getRepository(AccessGroupEntity);
        const groupMembershipRepository = dataSource.getRepository(
            GroupMembershipEntity,
        );
        const affiliationGroupService = new AffiliationGroupService(
            accessGroupRepository,
            groupMembershipRepository,
        );

        // Load config
        const configPath = path.resolve(
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
            factoryManager,
            dataSource,
            affiliationGroupService,
            config,
        );

        const { createdMissions, tagTypes } = await seedProjects(
            factoryManager,
            dataSource,
            adminUser,
            internalUser,
        );

        await seedActionTemplates(dataSource, adminUser);

        await seedFiles(
            factoryManager,
            dataSource,
            adminUser,
            createdMissions,
            tagTypes,
        );
    }
}
