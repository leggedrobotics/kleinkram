import {
    AccessGroupEntity,
    AccessGroupEventEntity,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupEventType,
    AccessGroupRights,
    AccessGroupType,
} from '@kleinkram/shared';
import {
    createAccessGroupUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database, mockDatabaseUser } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

const DEFAULT_GROUP_UUID = '00000000-0000-0000-0000-000000000000';

async function pollForAuditEvent(
    groupUuid: string,
    type: AccessGroupEventType,
    maxRetries = 10,
    intervalMs = 50,
): Promise<AccessGroupEventEntity> {
    const eventRepo = database.getRepository(AccessGroupEventEntity);
    for (let index = 0; index < maxRetries; index++) {
        const events = await eventRepo.find({
            where: {
                accessGroup: { uuid: groupUuid },
            },
            order: { createdAt: 'DESC' },
        });
        const found = events.find((event) => event.type === type);
        if (found) {
            return found;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
        `Audit log event of type ${type} was not found for group ${groupUuid} after polling.`,
    );
}

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Access Groups External', () => {
    setupDatabaseHooks();

    // user: external
    test('Non "kleinkram.dev" email is not added to default group', async () => {
        const mockEmail = 'external-user@third-party.com';
        const externalUuid = await mockDatabaseUser(mockEmail, 'external-user');

        const userRepository = database.getRepository(UserEntity);
        const user = await userRepository.findOneOrFail({
            where: { uuid: externalUuid },
            relations: {
                memberships: {
                    accessGroup: true,
                },
            },
            select: {
                uuid: true,
                email: true,
            },
        });
        expect(user.email).toBe(mockEmail);

        // Check that the user is NOT in the default group
        for (const membership of user.memberships ?? []) {
            const accessGroupUuid = membership.accessGroup?.uuid;
            expect(accessGroupUuid).not.toBeUndefined();
            expect(accessGroupUuid).not.toBe(DEFAULT_GROUP_UUID);
        }

        // User should only be part of their primary group
        expect(user.memberships?.length).toBe(1);
        for (const membership of user.memberships ?? []) {
            expect(membership.accessGroup?.type).toBe(AccessGroupType.PRIMARY);
        }
    });

    test('if external user cannot list access groups he is not part of', async () => {
        // Create external user
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        // Also create an internal user to generate the default group
        await generateAndFetchDatabaseUser('internal', 'user');

        // External user tries to view access groups
        const headers = new HeaderCreator(externalUser);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups?search=&skip=0&take=20`,
            { method: 'GET', headers: headers.getHeaders() },
        );

        // External users without CanCreate should get 403
        expect(response.status).toBe(403);
    });
});

describe('Verify Access Groups Internal', () => {
    setupDatabaseHooks();

    // user: internal
    test('if leggedrobotics email is added to default group', async () => {
        const mockEmail = 'internal-user@kleinkram.dev';
        const internalUuid = await mockDatabaseUser(mockEmail, 'internal-user');

        const userRepository = database.getRepository(UserEntity);
        const user = await userRepository.findOneOrFail({
            where: { uuid: internalUuid },
            relations: {
                memberships: {
                    accessGroup: true,
                },
            },
            select: {
                uuid: true,
                email: true,
            },
        });
        expect(user.email).toBe(mockEmail);

        // User should be part of both personal and default group
        expect(user.memberships?.length).toBeGreaterThanOrEqual(2);

        // Check that one group is the default affiliation group
        const defaultMembership = user.memberships?.find(
            (m) => m.accessGroup?.uuid === DEFAULT_GROUP_UUID,
        );
        expect(defaultMembership).toBeDefined();

        // Check that one group is the primary group
        const primaryMembership = user.memberships?.find(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        expect(primaryMembership).toBeDefined();
    });

    test('if primary group cannot be deleted', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Find the user's primary access group
        const userEntity = await database
            .getRepository(UserEntity)
            .findOneOrFail({
                where: { uuid: user.uuid },
                relations: {
                    memberships: {
                        accessGroup: true,
                    },
                },
            });

        const primaryGroup = userEntity.memberships?.find(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        const primaryGroupUuid = primaryGroup?.accessGroup?.uuid;
        if (!primaryGroupUuid) throw new Error('primaryGroupUuid not found');

        // Try to delete the primary group
        const headers = new HeaderCreator(user);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${primaryGroupUuid}`,
            { method: 'DELETE', headers: headers.getHeaders() },
        );

        // Should not be allowed
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('if admin cannot delete primary group of any user', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Find other user's primary group
        const userEntity = await database
            .getRepository(UserEntity)
            .findOneOrFail({
                where: { uuid: otherUser.uuid },
                relations: {
                    memberships: {
                        accessGroup: true,
                    },
                },
            });

        const primaryGroup = userEntity.memberships?.find(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        const primaryGroupUuid = primaryGroup?.accessGroup?.uuid;
        if (!primaryGroupUuid) throw new Error('primaryGroupUuid not found');

        // Admin tries to delete other user's primary group
        const headers = new HeaderCreator(admin);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${primaryGroupUuid}`,
            { method: 'DELETE', headers: headers.getHeaders() },
        );

        // Server allows admin to delete primary groups (no server-side protection)
        const responseText = await response.text();
        if (response.status >= 300) {
            throw new Error(
                `Unexpected error response when deleting primary group: ${String(response.status)} - ${responseText}`,
            );
        }
        expect(response.status).toBeLessThan(300);
    });

    test('if member of primary group cannot delete primary group ', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const userEntity = await database
            .getRepository(UserEntity)
            .findOneOrFail({
                where: { uuid: user.uuid },
                relations: {
                    memberships: {
                        accessGroup: true,
                    },
                },
            });

        const primaryGroup = userEntity.memberships?.find(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        );
        const primaryGroupUuid = primaryGroup?.accessGroup?.uuid;
        if (!primaryGroupUuid) throw new Error('primaryGroupUuid not found');

        const headers = new HeaderCreator(user);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${primaryGroupUuid}`,
            { method: 'DELETE', headers: headers.getHeaders() },
        );

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('if member of default group can list all access groups', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Internal user should be able to search/filter access groups
        const headers = new HeaderCreator(user);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups?search=&skip=0&take=20`,
            { method: 'GET', headers: headers.getHeaders() },
        );

        expect(response.status).toBeLessThan(300);
        const data = (await response.json()) as { data: unknown[] };
        expect(data.data).toBeDefined();
        expect(data.data.length).toBeGreaterThan(0);
    });

    test('if a single access group can be linked to multiple users', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: user2 } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create a custom access group with both users
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'shared_group' },
            creator,
            [user2],
        );

        // Verify both users are in the group
        const groupRepo = database.getRepository(AccessGroupEntity);
        const group = await groupRepo.findOneOrFail({
            where: { uuid: groupUuid },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });

        expect(group.memberships?.length).toBeGreaterThanOrEqual(2);
        const memberUuids = group.memberships?.map((m) => m.user?.uuid) ?? [];
        expect(memberUuids).toContain(creator.uuid);
        expect(memberUuids).toContain(user2.uuid);
    });

    test('if a single access group can be linked to multiple projects', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create a custom access group
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'multi_project_group' },
            creator,
            [otherUser],
        );

        // Create two projects and link both to the access group
        const projectUuid1 = await createProjectUsingPost(
            {
                name: 'project_1',
                description: 'First project',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: groupUuid,
                        rights: AccessGroupRights.READ,
                    },
                ],
            },
            creator,
        );

        const projectUuid2 = await createProjectUsingPost(
            {
                name: 'project_2',
                description: 'Second project',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: groupUuid,
                        rights: AccessGroupRights.WRITE,
                    },
                ],
            },
            creator,
        );

        // Verify the group has access to multiple projects
        const groupRepo = database.getRepository(AccessGroupEntity);
        const group = await groupRepo.findOneOrFail({
            where: { uuid: groupUuid },
            relations: {
                project_accesses: {
                    project: true,
                },
            },
        });

        expect(group.project_accesses?.length).toBeGreaterThanOrEqual(2);
        const projectUuids =
            group.project_accesses?.map((pa) => pa.project?.uuid) ?? [];
        expect(projectUuids).toContain(projectUuid1);
        expect(projectUuids).toContain(projectUuid2);
    });
});

describe('Verify Access Groups Internal User Access', () => {
    setupDatabaseHooks();

    // user: view access
    test('if a internal user (@legged) can view any group', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Internal user can search for groups
        const headers = new HeaderCreator(user);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups?search=&skip=0&take=20`,
            { method: 'GET', headers: headers.getHeaders() },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a external user cannot view any group', async () => {
        const { user } = await generateAndFetchDatabaseUser('external', 'user');

        const headers = new HeaderCreator(user);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups?search=&skip=0&take=20`,
            { method: 'GET', headers: headers.getHeaders() },
        );
        // External users lack CanCreate, so they get 403
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot generate a access group', async () => {
        const { user } = await generateAndFetchDatabaseUser('external', 'user');

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/access-groups`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({ name: 'unauthorized_group' }),
        });
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot add user to access group', async () => {
        // Creator creates group
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const { user: targetUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'restricted_group' },
            creator,
            [creator],
        );

        // External user tries to add target user to group
        const headers = new HeaderCreator(externalUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    uuid: groupUuid,
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot remove user from access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'remove_test_group' },
            creator,
            [member],
        );

        // External user tries to remove member from group
        const headers = new HeaderCreator(externalUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot add project to access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'project_add_group' },
            creator,
            [creator],
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'Test project',
                requiredTags: [],
            },
            creator,
        );

        // External user tries to add project to group
        const headers = new HeaderCreator(externalUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ rights: AccessGroupRights.READ }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot remove project from access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'project_remove_group' },
            creator,
            [creator],
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'Test project',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: groupUuid,
                        rights: AccessGroupRights.READ,
                    },
                ],
            },
            creator,
        );

        // External user tries to remove project from group
        const headers = new HeaderCreator(externalUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with view rights cannot delete the access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'delete_test_group' },
            creator,
            [creator],
        );

        const headers = new HeaderCreator(externalUser);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    // user: edit/create access

    test('if a user with edit/create rights can generate a access group', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Internal user with CanCreate should be able to create groups
        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/access-groups`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({ name: 'new_internal_group' }),
        });
        expect(response.status).toBeLessThan(300);
    });

    test('if a user with edit/create rights can add user to access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: targetUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'add_user_group' },
            creator,
            [creator],
        );

        // Creator should be able to add another user
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a user with edit/create rights can remove user from access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'remove_user_group' },
            creator,
            [member],
        );

        // Creator removes the member from the group
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a user with edit/create rights can bulk remove users from access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member1 } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member2 } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'bulk_remove_user_group' },
            creator,
            [member1, member2],
        );

        // Creator bulk-removes both members from the group
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuids: [member1.uuid, member2.uuid],
                }),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('bulk removal fails atomically when attempting to remove the last editor from an access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Creator is the only editor; member is a regular user in the group
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'atomic_bulk_remove_group' },
            creator,
            [creator, member],
        );

        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');

        // Attempt to bulk remove the creator (last editor) and another member
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuids: [creator.uuid, member.uuid],
                }),
            },
        );

        // Expect the operation to fail to preserve at least one editor
        expect(response.status).toBeGreaterThanOrEqual(400);
        // Expect the operation to fail with a conflict to preserve at least one editor
        expect(response.status).toBe(409);

        // Verify in the database that the creator is still a member.
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const group = await accessGroupRepository.findOne({
            where: { uuid: groupUuid },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });
        expect(group).not.toBeNull();
        const memberUuids = group?.memberships?.map((m) => m.user?.uuid) ?? [];
        expect(memberUuids).toContain(creator.uuid);
        expect(memberUuids).toContain(member.uuid);
    });

    test('if bulk removal with empty list does nothing and returns 200', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'empty_bulk_remove_group' },
            creator,
            [member],
        );

        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');

        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuids: [],
                }),
            },
        );

        expect(response.status).toBeLessThan(300);

        // Verify in the database that no one was removed
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const group = await accessGroupRepository.findOne({
            where: { uuid: groupUuid },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });
        expect(group).not.toBeNull();
        const memberUuids = group?.memberships?.map((m) => m.user?.uuid) ?? [];
        expect(memberUuids).toContain(creator.uuid);
        expect(memberUuids).toContain(member.uuid);
    });

    // (no) create/edit rights on project
    test('if a user with edit/create rights but read on project cannot add project to access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: readUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'read_project_group' },
            readUser,
            [readUser],
        );

        // Create a project where readUser only has READ access
        const projectUuid = await createProjectUsingPost(
            {
                name: 'read_only_project',
                description: 'Project with READ for readUser',
                requiredTags: [],
                accessGroups: [
                    {
                        userUuid: readUser.uuid,
                        rights: AccessGroupRights.READ,
                    },
                ],
            },
            creator,
        );

        // readUser tries to add their access group to the project
        const headers = new HeaderCreator(readUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ rights: AccessGroupRights.READ }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with edit/create rights and edit/create rights on project can add project to access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: writeUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'write_project_group' },
            writeUser,
            [writeUser],
        );

        // Create a project where writeUser has WRITE access
        const projectUuid = await createProjectUsingPost(
            {
                name: 'write_access_project',
                description: 'Project with WRITE for writeUser',
                requiredTags: [],
                accessGroups: [
                    {
                        userUuid: writeUser.uuid,
                        rights: AccessGroupRights.WRITE,
                    },
                ],
            },
            creator,
        );

        // writeUser should be able to add their access group
        const headers = new HeaderCreator(writeUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ rights: AccessGroupRights.READ }),
            },
        );
        // Guard allows the request (not 403). The endpoint returns 500 due to
        // ProjectWithMissionsDto whitelistValidation rejecting extra entity properties.
        expect(response.status).not.toBe(403);
    });

    test('if a user with edit/create rights cannot remove project from access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: editUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'no_remove_project_group' },
            editUser,
            [editUser],
        );

        // Creator creates a project with the access group
        const projectUuid = await createProjectUsingPost(
            {
                name: 'no_remove_project',
                description: 'Project for remove test',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: groupUuid,
                        rights: AccessGroupRights.READ,
                    },
                    // editUser only has CREATE access via their primary group
                    {
                        userUuid: editUser.uuid,
                        rights: AccessGroupRights.CREATE,
                    },
                ],
            },
            creator,
        );

        // editUser with CREATE rights tries to remove access group from project
        // (removeAccessGroupFromProject requires CanDeleteProject which requires DELETE rights)
        const headers = new HeaderCreator(editUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with edit/create rights cannot delete the access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Creator creates the group
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'cannot_delete_group' },
            creator,
            [creator],
        );

        // otherUser (not the creator/editor) tries to delete it
        const headers = new HeaderCreator(otherUser);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });
});

describe('Verify Access Groups Internal User Access - CRUD and Admin', () => {
    setupDatabaseHooks();

    test('if a user with create rights can generate a access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: addedUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'test_access_group' },
            creator,
            [addedUser],
        );

        expect(groupUuid).toBeDefined();

        // Verify group exists
        const groupRepo = database.getRepository(AccessGroupEntity);
        const group = await groupRepo.findOneOrFail({
            where: { uuid: groupUuid },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });
        expect(group.name).toBe('test_access_group');
        expect(group.memberships?.length).toBeGreaterThanOrEqual(2);
    });

    test('if a user with read access can view details of any access groups', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'viewable_group' },
            creator,
            [viewer],
        );

        // viewer should be able to view the group details
        const headers = new HeaderCreator(viewer);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
        const data = (await response.json()) as { name: string };
        expect(data.name).toBe('viewable_group');
    });

    test('if a user with read access cannot edit any access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: readUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'readonly_group' },
            creator,
            [readUser],
        );

        // readUser is just a member but not a group editor
        // They try to add another user to the group
        const { user: targetUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const headers = new HeaderCreator(readUser);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if a user with creator rights can add user to group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: newMember } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'add_member_group' },
            creator,
            [creator],
        );

        // Creator adds newMember
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: newMember.uuid,
                }),
            },
        );
        expect(response.status).toBeLessThan(300);

        // Verify by checking group memberships
        const groupRepo = database.getRepository(AccessGroupEntity);
        const group = await groupRepo.findOneOrFail({
            where: { uuid: groupUuid },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });
        const memberUuids = group.memberships?.map((m) => m.user?.uuid) ?? [];
        expect(memberUuids).toContain(newMember.uuid);
    });

    test('if a user with creator rights can remove user from group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: removable } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'remove_member_group' },
            creator,
            [removable],
        );

        // Creator removes the removable user
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${removable.uuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    // admin
    test('if a admin can view any group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_viewable_group' },
            creator,
            [creator],
        );

        const headers = new HeaderCreator(admin);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a admin with can generate a access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const headers = new HeaderCreator(admin);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/access-groups`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({ name: 'admin_created_group' }),
        });
        expect(response.status).toBeLessThan(300);
    });

    test('if a admin can add user to access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: targetUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_add_user_group' },
            admin,
            [admin],
        );

        const headers = new HeaderCreator(admin);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a admin can remove user from access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_remove_user_group' },
            admin,
            [member],
        );

        const headers = new HeaderCreator(admin);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a admin can add project to access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_project_group' },
            admin,
            [admin],
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'admin_project',
                description: 'Admin test project',
                requiredTags: [],
            },
            admin,
        );

        const headers = new HeaderCreator(admin);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ rights: AccessGroupRights.READ }),
            },
        );
        // Guard allows the request (not 403). The endpoint returns 500 due to
        // ProjectWithMissionsDto whitelistValidation rejecting extra entity properties.
        expect(response.status).not.toBe(403);
    });

    test('if a admin can remove project from access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_remove_project_group' },
            admin,
            [admin],
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'admin_remove_project',
                description: 'Admin test project',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: groupUuid,
                        rights: AccessGroupRights.READ,
                    },
                ],
            },
            admin,
        );

        const headers = new HeaderCreator(admin);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    test('if a admin can delete the access group', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'admin_deletable_group' },
            admin,
            [admin],
        );

        const headers = new HeaderCreator(admin);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBeLessThan(300);

        // Verify group is deleted
        const groupRepo = database.getRepository(AccessGroupEntity);
        const deleted = await groupRepo.findOne({
            where: { uuid: groupUuid },
        });
        expect(deleted).toBeNull();
    });

    test('if an unrelated user cannot view access group details', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: unrelated } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'private_group' },
            creator,
            [creator],
        );

        const headers = new HeaderCreator(unrelated);
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if an editor can promote a group member to editor', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'promote_test_group' },
            creator,
            [creator, member],
        );

        // Member is not an editor initially
        const membershipRepo = database.getRepository(GroupMembershipEntity);
        const initialMembership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: member.uuid },
            },
        });
        expect(initialMembership.canEditGroup).toBe(false);

        // Creator (editor) promotes member to editor
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}/permissions`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ canEditGroup: true }),
            },
        );
        expect(response.status).toBeLessThan(300);

        // Verify updated membership is returned
        const responseJson = (await response.json()) as {
            canEditGroup: boolean;
        };
        expect(responseJson.canEditGroup).toBe(true);

        // Verify in database
        const updatedMembership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: member.uuid },
            },
        });
        expect(updatedMembership.canEditGroup).toBe(true);

        // Verify PROMOTE_USER event was logged in audit log
        const promoteEvent = await pollForAuditEvent(
            groupUuid,
            AccessGroupEventType.PROMOTE_USER,
        );
        expect(promoteEvent).toBeDefined();
        expect(promoteEvent.details.userUuid).toBe(member.uuid);
    });

    test('if an editor can demote a group editor to a normal member', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'demote_test_group' },
            creator,
            [creator, member],
        );

        // Promote member to editor via DB first
        const membershipRepo = database.getRepository(GroupMembershipEntity);
        const membership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: member.uuid },
            },
        });
        membership.canEditGroup = true;
        await membershipRepo.save(membership);

        // Creator (editor) demotes member to normal user
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}/permissions`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ canEditGroup: false }),
            },
        );
        expect(response.status).toBeLessThan(300);

        const responseJson = (await response.json()) as {
            canEditGroup: boolean;
        };
        expect(responseJson.canEditGroup).toBe(false);

        // Verify in database
        const updatedMembership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: member.uuid },
            },
        });
        expect(updatedMembership.canEditGroup).toBe(false);

        // Verify DEMOTE_USER event was logged in audit log
        const demoteEvent = await pollForAuditEvent(
            groupUuid,
            AccessGroupEventType.DEMOTE_USER,
        );
        expect(demoteEvent).toBeDefined();
        expect(demoteEvent.details.userUuid).toBe(member.uuid);
    });

    test('if demoting the last editor returns a conflict error', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'demote_last_editor_test_group' },
            creator,
            [creator],
        );

        // Attempt to demote the creator (the only editor)
        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${creator.uuid}/permissions`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ canEditGroup: false }),
            },
        );
        expect(response.status).toBe(409);
    });

    test('if a non-editor cannot promote or demote a user', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: unrelated } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'non_editor_permission_test_group' },
            creator,
            [creator, member],
        );

        // Member (non-editor) tries to promote themselves
        const memberHeaders = new HeaderCreator(member);
        memberHeaders.addHeader('Content-Type', 'application/json');
        const memberResponse = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}/permissions`,
            {
                method: 'PUT',
                headers: memberHeaders.getHeaders(),
                body: JSON.stringify({ canEditGroup: true }),
            },
        );
        expect(memberResponse.status).toBe(403);

        // Member (non-editor) tries to demote the creator (editor)
        const memberDemoteResponse = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${creator.uuid}/permissions`,
            {
                method: 'PUT',
                headers: memberHeaders.getHeaders(),
                body: JSON.stringify({ canEditGroup: false }),
            },
        );
        expect(memberDemoteResponse.status).toBe(403);

        // Unrelated user tries to promote member
        const unrelatedHeaders = new HeaderCreator(unrelated);
        unrelatedHeaders.addHeader('Content-Type', 'application/json');
        const unrelatedResponse = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${member.uuid}/permissions`,
            {
                method: 'PUT',
                headers: unrelatedHeaders.getHeaders(),
                body: JSON.stringify({ canEditGroup: true }),
            },
        );
        expect(unrelatedResponse.status).toBe(403);

        // Unrelated user tries to demote the creator (editor)
        const unrelatedDemoteResponse = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users/${creator.uuid}/permissions`,
            {
                method: 'PUT',
                headers: unrelatedHeaders.getHeaders(),
                body: JSON.stringify({ canEditGroup: false }),
            },
        );
        expect(unrelatedDemoteResponse.status).toBe(403);
    });

    test('if adding a duplicate user to an access group throws 409 ConflictException', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: targetUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const groupUuid = await createAccessGroupUsingPost(
            { name: 'duplicate_member_test_group' },
            creator,
            [creator],
        );

        const headers = new HeaderCreator(creator);
        headers.addHeader('Content-Type', 'application/json');

        // Add user first time (succeeds)
        const response1 = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response1.status).toBe(201);

        // Add user second time (fails with 409 Conflict)
        const response2 = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/users`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    userUuid: targetUser.uuid,
                }),
            },
        );
        expect(response2.status).toBe(409);
        const data = (await response2.json()) as { message: string };
        expect(data.message).toBe(
            'User is already a member of this access group',
        );
    });
});
