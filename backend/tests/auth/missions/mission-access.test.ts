import {
    clearAllData,
    db as database,
} from '../../utils/database-utilities';

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Mission Level Admin Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // mission tests

        // admin: delete access by default
        
    test('if admin can create a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can view any mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can edit metadata of an mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });  

    test('if admin can move any mission', async() => {
        //TODO: implement this test
        
        expect(true).toBe(true);
    });

    test('if admin can delete any mission', async() => {
        //TODO: implement this test
        
        expect(true).toBe(true);
    });

    test('if admin can view any files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

        // admin: file access

    test('if admin can view any file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can edit any file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can download any file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can upload any file to a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can move any file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if admin can delete any file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });
});

describe('Verify Mission Level User Access', () => {
        beforeAll(async () => {
            await database.initialize();
            await clearAllData();
        });
    
        beforeEach(clearAllData);
        afterAll(async () => {
            await database.destroy();
        });

        // user: read/create access

    test('if user with create access on an project can create a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on an project can view any mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on an project cannot edit a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on an project cannot edit metadata of an mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on an project cannot move a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on an project cannot delete a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

        // user: modify access
    test('if user with modify/edit access on an project can edit a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with modify/edit access on an project can edit metadata of an mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with modify/edit access on an project cannot move a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with modify/edit access on an project cannot delete a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

        // user: delete access
    test('if user with modify/edit access on an project can move a mission', async() => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with delete access on an project can delete a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

});

describe('Verify Mission File Level User Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });
    // files in missions tests

        // user: read access
    test('if user with read access on a mission can view files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission cannot edit files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission can download files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission can upload file from google drive into mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission can upload file from local drive into mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission cannot move files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with read access on a mission cannot delete an file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

        // user: edit access

    test('if user with edit access on a mission can edit files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with edit access on a mission cannot move files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with edit access on a mission cannot delete an file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

        // user: delete access
    test('if user with delte access on a mission can move files in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with delete access on a mission can delete an file in a mission', async() => {
        //TODO: implement this test

        expect(true).toBe(true);
    });


});