import { clearAllData, db as database } from '../../utils/database-utilities';

/**
 * This test suite tests the access control of the application.
 *
 */


describe('Verify Project Groups Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // access Group Tests
    test('if user can add project with read access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with create access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with write access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with delete access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with read rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with create rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with write rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with delete rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
