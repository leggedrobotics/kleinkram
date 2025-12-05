import { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupFactoryContext } from '@backend-common/factories/auth/accessgroup.factory';
import { UserContext } from '@backend-common/factories/user/user.factory';
import { UserRole } from '@kleinkram/shared';
import { Connection } from 'typeorm';
import { Factory } from 'typeorm-seeding';

export interface SeededUsers {
    adminUser: UserEntity;
    internalUser: UserEntity;
    externalUser: UserEntity;
}

export const seedUsers = async (
    factory: Factory,
    conn: Connection,
): Promise<SeededUsers> => {
    console.log('1. Creating Users...');
    let adminUser: UserEntity;
    let internalUser: UserEntity;
    let externalUser: UserEntity;

    // Check if the specific users exist
    let existingAdmin: UserEntity | null = null;
    let existingInternal: UserEntity | null = null;
    let existingExternal: UserEntity | null = null;

    try {
        existingAdmin = await conn
            .getRepository(UserEntity)
            .findOne({ where: { email: 'admin@kleinkram.dev' } });
        existingInternal = await conn
            .getRepository(UserEntity)
            .findOne({ where: { email: 'internal-user@kleinkram.dev' } });
        existingExternal = await conn
            .getRepository(UserEntity)
            .findOne({ where: { email: 'external-user@example.com' } });
    } catch {
        console.log('Database tables not found, will create users');
    }

    if (existingAdmin && existingInternal && existingExternal) {
        console.log('Seed users already exist, skipping user creation');
        adminUser = existingAdmin;
        internalUser = existingInternal;
        externalUser = existingExternal;
    } else {
        console.log('Creating seed users...');
        adminUser = await factory(UserEntity)({
            mail: 'admin@kleinkram.dev',
            role: UserRole.ADMIN,
            defaultGroupIds: ['00000000-0000-0000-0000-000000000000'],
        } as UserContext).create();

        internalUser = await factory(UserEntity)({
            mail: 'internal-user@kleinkram.dev',
            role: UserRole.USER,
        } as UserContext).create();

        externalUser = await factory(UserEntity)({
            mail: 'external-user@example.com',
            role: UserRole.USER,
        } as UserContext).create();

        const allUsers = [adminUser, internalUser, externalUser];

        // Create personal access groups
        await Promise.all(
            allUsers.map((user) =>
                factory(AccessGroupEntity)({
                    user: user,
                    isPersonal: true,
                } as AccessGroupFactoryContext).create(),
            ),
        );
    }

    return { adminUser, internalUser, externalUser };
};
