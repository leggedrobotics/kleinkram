import {
    clearAllData,
    db as database,
} from '../../utils/database-utilities';


/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Access Groups External', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // user: external
    test('Non "leggedrobotics.com" email is not added to default group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
        
        // // create a user with a non default email
        // const mockEmail = 'external-user@third-party.com';
        // const externalUuid = await mockDatabaseUser(mockEmail);

        // const accessGroups = await getAllAccessGroups();
        // verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        // const primaryGroup = getAccessGroupForEmail(mockEmail, accessGroups);
        // expect(primaryGroup).toBeDefined();

        // // one access group should have the default uuid
        // const defaultGroup = accessGroups.filter(
        //     (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        // );
        // expect(defaultGroup.length).toBe(1);

        // const userRepository = database.getRepository(User);
        // const user = await userRepository.findOneOrFail({
        //     where: { uuid: externalUuid },
        //     relations: ['memberships', 'memberships.accessGroup'],
        //     select: ['uuid', 'email'],
        // });
        // expect(user.email).toBe(mockEmail);

        // // check if the user with a non default email is not added to the default group
        // user.memberships?.forEach((accessGroup: GroupMembership) => {
        //     const accessGroupUuid = accessGroup.accessGroup?.uuid;
        //     expect(accessGroupUuid).not.toBeUndefined();

        //     expect(
        //         DEFAULT_GROUP_UUIDS.includes(accessGroupUuid as string),
        //     ).toBe(false);
        // });

        // // user is only part of the primary group
        // expect(user.memberships?.length).toBe(1);
        // user.memberships?.forEach((accessGroup: GroupMembership) => {
        //     expect(accessGroup.accessGroup?.type).toBe(AccessGroupType.PRIMARY);
        // });
    });

    test('if external user cannot list access groups he is not part of', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});

describe('Verify Access Groups Internal', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // user: internal
    test('if leggedrobotics email is added to default group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);

        // const mockEmail = 'internal-user@leggedrobotics.com';
        // const internalUuid = await mockDatabaseUser(mockEmail);

        // const accessGroups = await getAllAccessGroups();
        // verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        // // one access group should be personal
        // const personalGroup = accessGroups.filter(
        //     (group: AccessGroup) => group.type === AccessGroupType.PRIMARY,
        // );
        // expect(personalGroup.length).toBe(1);

        // // one access group should have the default uuid
        // const defaultGroup = accessGroups.filter(
        //     (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        // );
        // expect(defaultGroup.length).toBe(1);

        // const userRepository = database.getRepository(User);
        // const user = await userRepository.findOneOrFail({
        //     where: { uuid: internalUuid },
        //     select: ['email'],
        // });

        // expect(user.email).toBe('internal-user@leggedrobotics.com');
    });

    test('if primary group cannot be deleted', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if admin cannot delete primary group of any user', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if member of primary group cannot delete primary group ', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if member of default group can list all access groups', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a single access group can be linked to multiple users', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a single access group can be linked to multiple projects', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});

describe('Verify Access Groups Internal User Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });
    // user: view access
    test('if a internal user (@legged) can view any group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a external user cannot view any group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot generate a access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot add user to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot remove user from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot add project to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot remove project from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with view rights cannot delete the access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // user: edit/create access

    test('if a user with edit/create rights can generate a access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with edit/create rights can add user to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with edit/create rights can remove user from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // (no) create/edit rights on project
    test('if a user with edit/create rights but read on project cannot add project to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with edit/create rights and edit/create rights on project can add project to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with edit/create rights cannot remove project from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with edit/create rights cannot delete the access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});

describe('Verify Access Groups Internal User Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    test('if a user with create rights can generate a access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
        
        // const { user: creator } = await generateAndFetchDatabaseUser(
        //     'internal',
        //     'user',
        // );
        // const { user: addedUser } = await generateAndFetchDatabaseUser(
        //     'internal',
        //     'user',
        // );
        // const rights = AccessGroupRights.READ;
        // const groupName = 'test_access_group';

        // // create access group
        // const groupUuid = await createAccessGroupUsingPost(
        //     {
        //         name: groupName,
        //     },
        //     creator,
        //     [addedUser],
        // );
    });

    test('if a user with read access can view details of any access groups', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with read access cannot edit any access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with creator rights can add user to group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a user with creator rights can remove user from group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // admin
    test('if a admin can view any group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin with can generate a access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can add user to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can remove user from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can add project to access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can remove project from access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can delete the access group', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
