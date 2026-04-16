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
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

describe('Affiliation Group Sync on Auth Early Returns', () => {
    setupDatabaseHooks();

    const TEST_GROUP_UUID = '00000000-1111-2222-3333-444444444444';
    const email = 'test-sync@kleinkram.dev';

    const testAccessConfig = {
        emails: [
            {
                email: 'kleinkram.dev',
                access_groups: [TEST_GROUP_UUID],
            },
        ],
        access_groups: [
            {
                name: 'Kleinkram Developers Test Group',
                uuid: TEST_GROUP_UUID,
            },
        ],
    } as AccessGroupConfig;

    let config: AccessGroupConfig;
    let affiliationGroupService: AffiliationGroupService;

    beforeAll(() => {
        config = testAccessConfig;

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
            (m) => m.accessGroup?.uuid === TEST_GROUP_UUID,
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
            (m) => m.accessGroup?.uuid === TEST_GROUP_UUID,
        );
        expect(hasKleinkramDevs).toBe(true);
    });

    test('should sync affiliation groups when logging in with existing account (validateAndCreateUserByGitHub)', async () => {
        const userRepository = database.getRepository(UserEntity);
        const accountRepository = database.getRepository(AccountEntity);

        const email3 = 'test-sync-3@kleinkram.dev';

        // 1. Create user and fully linked account via createNewUser
        await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: 'test-oauth-id-3',
                provider: Providers.GITHUB,
                email: email3,
                username: 'Test Sync 3',
                picture: '',
            },
        );

        // Remove the existing memberships to simulate an old user that missed out
        const groupMembershipRepository = database.getRepository(
            GroupMembershipEntity,
        );
        const existingMemberships = await groupMembershipRepository.find({
            where: { user: { email: email3 } },
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

        // 2. Call validateAndCreateUserByGitHub
        await authService.validateAndCreateUserByGitHub({
            id: 'test-oauth-id-3',
            emails: [{ value: email3 }],
            displayName: 'Test Sync 3',
            photos: [{ value: '' }],
        });

        // 3. Verify affiliation group membership was added back
        const userWithGroups = await userRepository.findOneOrFail({
            where: { email: email3 },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const hasKleinkramDevs = userWithGroups.memberships?.some(
            (m) => m.accessGroup?.uuid === TEST_GROUP_UUID,
        );
        expect(hasKleinkramDevs).toBe(true);
    });
});

describe('syncAccessGroups', () => {
    setupDatabaseHooks();

    const TEST_GROUP_UUID = '11111111-2222-3333-4444-555555555555';

    const testConfig = {
        emails: [
            {
                email: 'example.com',
                access_groups: [TEST_GROUP_UUID],
            },
        ],
        access_groups: [
            {
                name: 'Example Group',
                uuid: TEST_GROUP_UUID,
            },
        ],
    } as AccessGroupConfig;

    let affiliationGroupService: AffiliationGroupService;

    beforeAll(() => {
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
        await affiliationGroupService.createAccessGroups(testConfig);
    });

    test('adds missing memberships for matching users', async () => {
        const userRepository = database.getRepository(UserEntity);

        const user = userRepository.create({
            email: 'alice@example.com',
            name: 'Alice',
        });
        await userRepository.save(user);

        await affiliationGroupService.syncAccessGroups(
            testConfig,
            database.getRepository(UserEntity),
        );

        const memberships = await database
            .getRepository(GroupMembershipEntity)
            .find({
                where: {
                    user: { uuid: user.uuid },
                    accessGroup: { uuid: TEST_GROUP_UUID },
                },
                relations: ['accessGroup'],
            });
        expect(memberships).toHaveLength(1);
    });

    test('removes stale memberships for non-matching users', async () => {
        const userRepository = database.getRepository(UserEntity);
        const groupMembershipRepository = database.getRepository(
            GroupMembershipEntity,
        );

        const user = userRepository.create({
            email: 'bob@other.com',
            name: 'Bob',
        });
        await userRepository.save(user);

        // Manually add to affiliation group (simulates old config match)
        const membership = groupMembershipRepository.create({
            user: { uuid: user.uuid },
            accessGroup: { uuid: TEST_GROUP_UUID },
        });
        await groupMembershipRepository.save(membership);

        await affiliationGroupService.syncAccessGroups(
            testConfig,
            database.getRepository(UserEntity),
        );

        const remaining = await groupMembershipRepository.find({
            where: {
                user: { uuid: user.uuid },
                accessGroup: { uuid: TEST_GROUP_UUID },
            },
        });
        expect(remaining).toHaveLength(0);
    });

    test('is idempotent', async () => {
        const userRepository = database.getRepository(UserEntity);

        const user = userRepository.create({
            email: 'carol@example.com',
            name: 'Carol',
        });
        await userRepository.save(user);

        const userRepo = database.getRepository(UserEntity);
        await affiliationGroupService.syncAccessGroups(testConfig, userRepo);
        await affiliationGroupService.syncAccessGroups(testConfig, userRepo);

        const memberships = await database
            .getRepository(GroupMembershipEntity)
            .find({
                where: {
                    user: { uuid: user.uuid },
                    accessGroup: { uuid: TEST_GROUP_UUID },
                },
            });
        expect(memberships).toHaveLength(1);
    });
});
