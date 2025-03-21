import {
    clearAllData,
    db as database,
    getJwtToken,
    getUserFromDb as getUserFromDatabase,
    mockDbUser as mockDatabaseUser,
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
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // descrition
    test('if user ...', async () => {
        // TODO: implement this test
        expect(true).toBe(true);

    });
});