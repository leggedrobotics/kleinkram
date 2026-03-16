import { AuthService, createNewUser } from '@/services/auth.service';
import {
    AccessGroupEntity,
    AccountEntity,
    AffiliationGroupService,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupConfig, Providers } from '@kleinkram/shared';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'node:fs';
import path from 'node:path';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

describe('Affiliation Group Sync on Auth Early Returns', () => {
    setupDatabaseHooks();

    const email = 'test-sync@kleinkram.dev'; // Assuming kleinkram.dev is in access_config.json

    let config: AccessGroupConfig;
    let affiliationGroupService: AffiliationGroupService;

    beforeAll(() => {
        const configPath = path.join(
            __dirname,
            '../../../src/access_config.json',
        );
        config = JSON.parse(
            fs.readFileSync(configPath, 'utf8'),
        ) as AccessGroupConfig;

        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const groupMembershipRepository = database.getRepository(
            GroupMembershipEntity,
        );
        affiliationGroupService = new AffiliationGroupService(
            accessGroupRepository,
            groupMembershipRepository,
        );
    });

    beforeEach(async () => {
        await affiliationGroupService.createAccessGroups(config);
    });

    test('should sync affiliation groups when account is linked to existing user (createNewUser)', async () => {
        const userRepository = database.getRepository(UserEntity);
        const accountRepository = database.getRepository(AccountEntity);

        // 1. Create a user manually (no account)
        const user = userRepository.create({
            email,
            name: 'Test Sync',
        });
        await userRepository.save(user);

        // 2. Call createNewUser to link the account
        await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: 'test-oauth-id',
                provider: Providers.GITHUB,
                email,
                username: 'Test Sync',
                picture: '',
            },
        );

        // 3. Verify affiliation group membership
        const userWithGroups = await userRepository.findOneOrFail({
            where: { email },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const hasKleinkramDevs = userWithGroups.memberships?.some(
            (m) => m.accessGroup?.name === 'Kleinkram Developers',
        );
        expect(hasKleinkramDevs).toBe(true);
    });

    test('should sync affiliation groups when logging in with existing account (validateAndCreateUser)', async () => {
        const userRepository = database.getRepository(UserEntity);
        const accountRepository = database.getRepository(AccountEntity);

        const email2 = 'test-sync-2@kleinkram.dev';

        // 1. Create user and fully linked account via createNewUser
        await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: 'test-oauth-id-2',
                provider: Providers.FakeOAuth,
                email: email2,
                username: 'Test Sync 2',
                picture: '',
            },
        );

        // Remove the existing memberships to simulate an old user that missed out
        const groupMembershipRepository = database.getRepository(
            GroupMembershipEntity,
        );
        const existingMemberships = await groupMembershipRepository.find({
            where: { user: { email: email2 } },
        });
        for (const m of existingMemberships) {
            await groupMembershipRepository.remove(m);
        }

        const configService = {
            get: (key: string) => (key === 'accessConfig' ? config : undefined),
        } as unknown as ConfigService;

        const authService = new AuthService(
            {} as unknown as JwtService, // JwtService not needed for validateAndCreate
            accountRepository,
            userRepository,
            affiliationGroupService,
            configService,
        );

        // 2. Call validateAndCreateUserByFakeOAuth
        await authService.validateAndCreateUserByFakeOAuth({
            id: 'test-oauth-id-2',
            email: email2,
            displayName: 'Test Sync 2',
            photo: '',
        });

        // 3. Verify affiliation group membership was added back
        const userWithGroups = await userRepository.findOneOrFail({
            where: { email: email2 },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const hasKleinkramDevs = userWithGroups.memberships?.some(
            (m) => m.accessGroup?.name === 'Kleinkram Developers',
        );
        expect(hasKleinkramDevs).toBe(true);
    });
});
