import {
    clearAllData,
    db as database,
    getJwtToken,
    getUserFromDb as getUserFromDatabase,
    mockDbUser as mockDatabaseUser,
} from '../../utils/database_utils';

import {
    createProjectUsingPost,
    createMissionUsingPost,
    HeaderCreator,
    createTagUsingPost
} from '../../utils/api_calls';


import {
    generateAndFetchDbUser as generateAndFetchDatabaseUser,
    getAccessGroupForEmail,
    getAllAccessGroups,
} from '../utils';

import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
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

describe('Verify tags/metadata type generation', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    test('if internal user can add string tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.STRING,
                name: 'test_tag'
            },
            user,
        );
    });


    test('if internal user can add number tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.STRING,
                name: 'test_tag'
            },
            user,
        );
    });


    test('if internal user can add boolean tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.BOOLEAN,
                name: 'test_tag'
            },
            user,
        );
    });

    test('if internal user can add date tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.DATE,
                name: 'test_tag'
            },
            user,
        );
    });

    test('if internal user can add location tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.LOCATION,
                name: 'test_tag'
            },
            user,
        );
    });

    test('if internal user can add link tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.LINK,
                name: 'test_tag'
            },
            user,
        );

    });

    test('if internal user can add any tags/metadata', async () => {
        // TODO: add check in db
        const {user:user} = await generateAndFetchDatabaseUser('internal', 'user');

        const projectUuid = await createTagUsingPost({
                type: DataType.ANY,
                name: 'test_tag'
            },
            user,
        );
    });

});