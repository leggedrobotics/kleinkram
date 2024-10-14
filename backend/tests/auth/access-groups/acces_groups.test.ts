import User from '@common/entities/user/user.entity';
import { clearAllData, db, mock_db_user } from '../../utils/database_utils';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    DEFAULT_GROUP_UUIDS,
    getAccessGroupForEmail,
    getAllAccessGroups,
    verifyIfGroupWithUUIDExists,
} from '../utils';

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
        const mock_email = 'external-user@third-party.com';
        const external_uuid = await mock_db_user(mock_email);

        const accessGroups = await getAllAccessGroups();
        verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        const personal_group = getAccessGroupForEmail(mock_email, accessGroups);
        expect(personal_group).toBeDefined();

        // one access group should have the default uuid
        const default_group = accessGroups.filter(
            (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        );
        expect(default_group.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: external_uuid },
            relations: ['accessGroups'],
        });
        expect(user.email).toBe(mock_email);

        // check if the user with a non default email is not added to the default group
        user.accessGroups.forEach((accessGroup: AccessGroup) => {
            expect(DEFAULT_GROUP_UUIDS.includes(accessGroup.uuid)).toBe(false);
        });

        // user is only part of the personal group
        expect(user.accessGroups.length).toBe(1);
        user.accessGroups.forEach((accessGroup: AccessGroup) => {
            expect(accessGroup.personal).toBe(true);
        });
    });

    test('if leggedrobotics email is added to default group', async () => {
        const mock_email = 'internal-user@leggedrobotics.com';
        const internal_uuid = await mock_db_user(mock_email);

        const accessGroups = await getAllAccessGroups();
        verifyIfGroupWithUUIDExists(DEFAULT_GROUP_UUIDS[0], accessGroups);

        // one access group should be personal
        const personal_group = accessGroups.filter(
            (group: AccessGroup) => group.personal === true,
        );
        expect(personal_group.length).toBe(1);

        // one access group should have the default uuid
        const default_group = accessGroups.filter(
            (group: AccessGroup) => group.uuid === DEFAULT_GROUP_UUIDS[0],
        );
        expect(default_group.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: internal_uuid },
            relations: ['accessGroups'],
        });

        expect(user.email).toBe('internal-user@leggedrobotics.com');
    });

    test('if external user cannot list access groups he is not part of', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if personal group cannot be deleted', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if admin cannot delete personal group of any user', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if member of personal group cannot delete personal group ', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if member of default group can list all access groups', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if a single access group can be linked to multiple users', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if a single access group can be linked to multiple projects', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });
});
