import {
    clearAllData,
    db,
    getJwtToken,
    getUserFromDb,
    mockDbUser,
} from '../../utils/database_utils';
import { createProjectUsingPost } from '../../utils/api_calls';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '../../../../common/frontend_shared/enum';
import User from '../../../../common/entities/user/user.entity';

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Project Level Access', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });


    // define tests

    test('if viewer of a project cannot add any tag types', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if viewer of a project cannot add any tag types', async() => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if editor of a project can add any tag types', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if viewer of a project cannot delete any tag types', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if editor of a project can delete any tag types', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });


});
