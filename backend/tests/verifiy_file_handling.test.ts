import {
    clearAllData,
    db,
    get_jwt_token,
    get_user_from_db,
    mock_db_user,
} from './utils/database_utils';
import {
    create_mission_using_post,
    create_project_using_post,
    upload_file,
} from './utils/api_calls';

describe('Verify File Handling', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    test('Test if file is uploaded and can be downloaded again', async () => {
        const filename = 'test_small.bag';

        const user_id = await mock_db_user('internal@leggedrobotics.com');
        const user = await get_user_from_db(user_id);

        // create project
        const project_uuid = await create_project_using_post(
            {
                name: 'test_project',
                description: 'test description',
                requiredTags: [],
            },
            user,
        );
        expect(project_uuid).toBeDefined();

        // create mission using the post
        const mission_uuid = await create_mission_using_post(
            {
                name: 'test_mission2',
                projectUUID: project_uuid,
                tags: {},
            },
            user,
        );
        expect(mission_uuid).toBeDefined();
        const file_hash = await upload_file(user, filename, mission_uuid);

        // get file uuid by calling /file/oneByName
        const res_oneByName = await fetch(
            `http://localhost:3000/file/byName?name=${filename}`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${await get_jwt_token(user)}`,
                },
            },
        );

        expect(res_oneByName.status).toBe(200);
        const json_oneByName = await res_oneByName.json();
        expect(json_oneByName).toBeDefined();
        expect(json_oneByName.uuid).toBeDefined();

        // download file
        // http://localhost:3000/file/download?uuid={uuid}
        const res_download = await fetch(
            `http://localhost:3000/file/download?uuid=${json_oneByName.uuid}&expires=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${await get_jwt_token(user)}`,
                },
            },
        );

        expect(res_download.status).toBe(200);
        const download_file = await res_download.blob();

        // verify file content
        const download_file_hash = await crypto.subtle.digest(
            'SHA-256',
            await download_file.arrayBuffer(),
        );

        expect(download_file_hash).toEqual(file_hash);
    }, 30_000);

    test('Test if two files can be uploaded and downloaded in parallel', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if two files with the same name cannot be uploaded to the same mission', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if project can be renamed while uploading a file', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if mission can be renamed while uploading a file', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot upload file with arbitrary name', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot upload file to arbitrary bucket', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you can abort the upload, then retry', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot download a file you should not have access to', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
