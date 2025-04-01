import {
    clearAllData,
    database,
} from '../../utils/database-utilities';

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