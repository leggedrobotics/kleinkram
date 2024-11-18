import User from '@common/entities/user/user.entity';
import { clearAllData, db, mockDbUser } from '../../utils/database_utils';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    DEFAULT_GROUP_UUIDS,
    getAccessGroupForEmail,
    getAllAccessGroups,
    verifyIfGroupWithUUIDExists,
} from '../utils';
import GroupMembership from '@common/entities/auth/group_membership.entity';
import { AccessGroupType } from '@common/enum';

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Access Groups', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    test('Non "leggedrobotics.com" email is not added to default group', async () => {
        // create a user with a non default email
        const mockEmail = 'external-user@third-party.com';
        const externalUuid = await mockDbUser(mockEmail);

        const accessGroups = await getAllAccessGroups();
        verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        const primaryGroup = getAccessGroupForEmail(mockEmail, accessGroups);
        expect(primaryGroup).toBeDefined();

        // one access group should have the default uuid
        const defaultGroup = accessGroups.filter(
            (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        );
        expect(defaultGroup.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: externalUuid },
            relations: ['memberships', 'memberships.accessGroup'],
            select: ['uuid', 'email'],
        });
        expect(user.email).toBe(mockEmail);

        // check if the user with a non default email is not added to the default group
        user.memberships.forEach((accessGroup: GroupMembership) => {
            expect(
                DEFAULT_GROUP_UUIDS.includes(accessGroup.accessGroup.uuid),
            ).toBe(false);
        });

        // user is only part of the primary group
        expect(user.memberships.length).toBe(1);
        user.memberships.forEach((accessGroup: GroupMembership) => {
            expect(accessGroup.accessGroup.type).toBe(AccessGroupType.PRIMARY);
        });
    });

    test('if leggedrobotics email is added to default group', async () => {
        const mockEmail = 'internal-user@leggedrobotics.com';
        const internalUuid = await mockDbUser(mockEmail);

        const accessGroups = await getAllAccessGroups();
        verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        // one access group should be personal
        const personalGroup = accessGroups.filter(
            (group: AccessGroup) => group.type === AccessGroupType.PRIMARY,
        );
        expect(personalGroup.length).toBe(1);

        // one access group should have the default uuid
        const defaultGroup = accessGroups.filter(
            (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        );
        expect(defaultGroup.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: internalUuid },
            select: ['email'],
        });

        expect(user.email).toBe('internal-user@leggedrobotics.com');
    });

    test('if external user cannot list access groups he is not part of', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if primary group cannot be deleted', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if admin cannot delete primary group of any user', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if member of primary group cannot delete primary group ', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if member of default group can list all access groups', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a single access group can be linked to multiple users', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a single access group can be linked to multiple projects', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
