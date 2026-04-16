import { createNewUser } from '@/services/auth.service';
import {
    AccessGroupEntity,
    AccountEntity,
    AffiliationGroupService,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupConfig,
    AccessGroupType,
    Providers,
} from '@kleinkram/shared';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

describe('Affiliation Group Sync on Reboot', () => {
    setupDatabaseHooks();

    const GROUP_A_UUID = '00000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const GROUP_B_UUID = '00000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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

    const createUser = async (email: string, config: AccessGroupConfig) => {
        const userRepository = database.getRepository(UserEntity);
        const accountRepository = database.getRepository(AccountEntity);
        await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: `oauth-${email}`,
                provider: Providers.FakeOAuth,
                email,
                username: email.split('@')[0],
                picture: '',
            },
        );
    };

    test('should add users to a new affiliation group on sync', async () => {
        const userRepository = database.getRepository(UserEntity);

        const initialConfig: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.createAccessGroups(initialConfig);
        await createUser('alice@kleinkram.dev', initialConfig);

        // Now add Group B to config and sync
        const updatedConfig: AccessGroupConfig = {
            emails: [
                {
                    email: 'kleinkram.dev',
                    access_groups: [GROUP_A_UUID, GROUP_B_UUID],
                },
            ],
            access_groups: [
                { name: 'Group A', uuid: GROUP_A_UUID, rights: 10 },
                { name: 'Group B', uuid: GROUP_B_UUID, rights: 5 },
            ],
        };

        await affiliationGroupService.syncAccessGroups(
            updatedConfig,
            userRepository,
        );

        const user = await userRepository.findOneOrFail({
            where: { email: 'alice@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const groupUuids =
            user.memberships?.map((m) => m.accessGroup?.uuid) ?? [];
        expect(groupUuids).toContain(GROUP_A_UUID);
        expect(groupUuids).toContain(GROUP_B_UUID);
    });

    test('should remove memberships when group is removed from config', async () => {
        const userRepository = database.getRepository(UserEntity);

        const initialConfig: AccessGroupConfig = {
            emails: [
                {
                    email: 'kleinkram.dev',
                    access_groups: [GROUP_A_UUID, GROUP_B_UUID],
                },
            ],
            access_groups: [
                { name: 'Group A', uuid: GROUP_A_UUID, rights: 10 },
                { name: 'Group B', uuid: GROUP_B_UUID, rights: 5 },
            ],
        };

        await affiliationGroupService.createAccessGroups(initialConfig);
        await createUser('bob@kleinkram.dev', initialConfig);

        // Remove Group B from config
        const updatedConfig: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.syncAccessGroups(
            updatedConfig,
            userRepository,
        );

        const user = await userRepository.findOneOrFail({
            where: { email: 'bob@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const groupUuids =
            user.memberships?.map((m) => m.accessGroup?.uuid) ?? [];
        expect(groupUuids).toContain(GROUP_A_UUID);
        expect(groupUuids).not.toContain(GROUP_B_UUID);

        // Group B should be soft-deleted
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const groupB = await accessGroupRepository.findOne({
            where: { uuid: GROUP_B_UUID },
        });
        expect(groupB).toBeNull();
    });

    test('should update group name when changed in config', async () => {
        const userRepository = database.getRepository(UserEntity);

        const initialConfig: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.syncAccessGroups(
            initialConfig,
            userRepository,
        );

        const updatedConfig: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A Renamed', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.syncAccessGroups(
            updatedConfig,
            userRepository,
        );

        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const group = await accessGroupRepository.findOneOrFail({
            where: { uuid: GROUP_A_UUID },
        });
        expect(group.name).toBe('Group A Renamed');
    });

    test('should remove memberships when email pattern changes', async () => {
        const userRepository = database.getRepository(UserEntity);

        const initialConfig: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.createAccessGroups(initialConfig);
        await createUser('carol@kleinkram.dev', initialConfig);

        // Change email pattern so carol no longer matches
        const updatedConfig: AccessGroupConfig = {
            emails: [
                { email: 'other-domain.com', access_groups: [GROUP_A_UUID] },
            ],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.syncAccessGroups(
            updatedConfig,
            userRepository,
        );

        const user = await userRepository.findOneOrFail({
            where: { email: 'carol@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const affiliationMemberships = (user.memberships ?? []).filter(
            (m) => m.accessGroup?.type === AccessGroupType.AFFILIATION,
        );
        expect(affiliationMemberships).toHaveLength(0);
    });

    test('should be idempotent when called twice with same config', async () => {
        const userRepository = database.getRepository(UserEntity);

        const config: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.createAccessGroups(config);
        await createUser('dave@kleinkram.dev', config);

        await affiliationGroupService.syncAccessGroups(config, userRepository);
        await affiliationGroupService.syncAccessGroups(config, userRepository);

        const user = await userRepository.findOneOrFail({
            where: { email: 'dave@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const affiliationMemberships = (user.memberships ?? []).filter(
            (m) => m.accessGroup?.type === AccessGroupType.AFFILIATION,
        );
        expect(affiliationMemberships).toHaveLength(1);
        expect(affiliationMemberships[0].accessGroup?.uuid).toBe(GROUP_A_UUID);
    });

    test('should not touch primary or custom groups', async () => {
        const userRepository = database.getRepository(UserEntity);

        const config: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.createAccessGroups(config);
        await createUser('eve@kleinkram.dev', config);

        // Verify user has a primary group
        const userBefore = await userRepository.findOneOrFail({
            where: { email: 'eve@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });
        const primaryBefore = (userBefore.memberships ?? []).filter(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        expect(primaryBefore.length).toBeGreaterThan(0);

        // Sync with empty config (no affiliation groups)
        const emptyConfig: AccessGroupConfig = {
            emails: [],
            access_groups: [],
        };

        await affiliationGroupService.syncAccessGroups(
            emptyConfig,
            userRepository,
        );

        // Primary group should still exist
        const userAfter = await userRepository.findOneOrFail({
            where: { email: 'eve@kleinkram.dev' },
            relations: ['memberships', 'memberships.accessGroup'],
        });
        const primaryAfter = (userAfter.memberships ?? []).filter(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        expect(primaryAfter).toHaveLength(primaryBefore.length);
    });

    test('should remove manually-added affiliation membership when user does not match pattern', async () => {
        const userRepository = database.getRepository(UserEntity);
        const groupMembershipRepository = database.getRepository(
            GroupMembershipEntity,
        );

        const config: AccessGroupConfig = {
            emails: [{ email: 'kleinkram.dev', access_groups: [GROUP_A_UUID] }],
            access_groups: [{ name: 'Group A', uuid: GROUP_A_UUID, rights: 10 }],
        };

        await affiliationGroupService.createAccessGroups(config);

        // Create an external user (non-matching email)
        await createUser('frank@external.com', config);

        // Manually add the external user to the affiliation group
        const frank = await userRepository.findOneOrFail({
            where: { email: 'frank@external.com' },
        });
        const manualMembership = groupMembershipRepository.create({
            user: { uuid: frank.uuid },
            accessGroup: { uuid: GROUP_A_UUID },
        });
        await groupMembershipRepository.save(manualMembership);

        // Sync should remove the manual membership
        await affiliationGroupService.syncAccessGroups(config, userRepository);

        const updatedFrank = await userRepository.findOneOrFail({
            where: { email: 'frank@external.com' },
            relations: ['memberships', 'memberships.accessGroup'],
        });
        const affiliationMemberships = (updatedFrank.memberships ?? []).filter(
            (m) => m.accessGroup?.type === AccessGroupType.AFFILIATION,
        );
        expect(affiliationMemberships).toHaveLength(0);
    });
});
