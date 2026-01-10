import { systemUser } from '@backend-common/consts';
import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupFactoryContext } from '@backend-common/factories/auth/accessgroup.factory';
import { UserContext } from '@backend-common/factories/user/user.factory';
import { AffiliationGroupService } from '@backend-common/services/affiliation-group.service';
import {
    AccessGroupConfig,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { DataSource, Not } from 'typeorm';
import { SeederFactoryManager } from 'typeorm-extension';

export interface SeededUsers {
    adminUser: UserEntity;
    internalUser: UserEntity;
    externalUser: UserEntity;
}

export const seedUsers = async (
    factoryManager: SeederFactoryManager,

    dataSource: DataSource,
    affiliationGroupService?: AffiliationGroupService,
    config?: AccessGroupConfig,
): Promise<SeededUsers> => {
    // eslint-disable-next-line no-console
    console.log('1. Creating Users...');

    const userCount = await dataSource.getRepository(UserEntity).count({
        where: { uuid: Not(systemUser.uuid) },
    });
    if (userCount > 0) {
        // eslint-disable-next-line no-console
        console.log('Users exist in DB, skipping seeding.');
        const users = await dataSource.getRepository(UserEntity).find({
            select: ['uuid', 'email', 'name', 'role', 'avatarUrl'],
        });
        // eslint-disable-next-line no-console
        console.log('Existing users:', users.map((u) => u.email).join(', '));

        const adminUser = users.find((u) => u.email === 'admin@kleinkram.dev');
        const internalUser = users.find(
            (u) => u.email === 'internal-user@kleinkram.dev',
        );
        const externalUser = users.find(
            (u) => u.email === 'external-user@example.com',
        );

        if (!adminUser || !internalUser || !externalUser) {
            console.warn(
                'WARNING: Users exist but standard seed users are missing. Returning undefined references.',
            );

            throw new Error(
                'Database is populated but missing seed users (admin/internal/external). Please clear database to re-seed.',
            );
        }

        return { adminUser, internalUser, externalUser };
    }

    // Helper to create or get user
    const createOrGetUser = async (
        email: string,
        context: UserContext,
    ): Promise<UserEntity> => {
        const existing = await dataSource
            .getRepository(UserEntity)
            .findOne({ where: { email } });

        if (existing) {
            // eslint-disable-next-line no-console
            console.log(`User ${email} already exists.`);
            return existing;
        }

        // eslint-disable-next-line no-console
        console.log(`Creating user ${email}...`);
        return factoryManager.get(UserEntity).setMeta(context).save();
    };

    const adminUser = await createOrGetUser('admin@kleinkram.dev', {
        mail: 'admin@kleinkram.dev',
        role: UserRole.ADMIN,
        defaultGroupIds: ['00000000-0000-0000-0000-000000000000'],
    } as UserContext);

    const internalUser = await createOrGetUser('internal-user@kleinkram.dev', {
        mail: 'internal-user@kleinkram.dev',
        role: UserRole.USER,
    } as UserContext);

    const externalUser = await createOrGetUser('external-user@example.com', {
        mail: 'external-user@example.com',
        role: UserRole.USER,
    } as UserContext);

    const allUsers = [adminUser, internalUser, externalUser];

    // Create personal access groups
    await Promise.all(
        allUsers.map(async (user) => {
            // We can check memberships
            const userWithGroups = await dataSource
                .getRepository(UserEntity)
                .findOne({
                    where: { uuid: user.uuid },
                    relations: ['memberships', 'memberships.accessGroup'],
                });

            const hasPrimary = userWithGroups?.memberships?.some(
                (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
            );

            if (!hasPrimary) {
                await factoryManager
                    .get(AccessGroupEntity)
                    .setMeta({
                        user: user,
                        isPersonal: true,
                    } as Partial<AccessGroupFactoryContext>)
                    .save();
            }
        }),
    );

    if (affiliationGroupService && config) {
        await Promise.all(
            allUsers.map((user) =>
                affiliationGroupService.addToAffiliationGroups(config, user),
            ),
        );
    }

    return { adminUser, internalUser, externalUser };
};
