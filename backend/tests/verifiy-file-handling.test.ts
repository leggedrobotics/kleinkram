import { clearAllData, database } from './utils/database-utilities';

describe('Verify File Handling', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    test('Test if file is uploaded and can be downloaded again', async () => {
        // TODO: implement this test
        expect(true).toBe(true);

        // const filename = 'test_small.bag';

        // const userId = await mockDatabaseUser('internal@leggedrobotics.com');
        // const user = await getUserFromDatabase(userId);

        // // create project
        // const projectUuid = await createProjectUsingPost(
        //     {
        //         name: 'test_project',
        //         description: 'test description',
        //         requiredTags: [],
        //     },
        //     user,
        // );
        // expect(projectUuid).toBeDefined();

        // // create mission using the post
        // const missionUuid = await createMissionUsingPost(
        //     {
        //         name: 'test_mission2',
        //         projectUUID: projectUuid,
        //         tags: {},
        //         ignoreTags: true,
        //     },
        //     user,
        // );
        // expect(missionUuid).toBeDefined();
        // const fileHash = await uploadFile(user, filename, missionUuid);

        // // get file uuid by calling /file/oneByName
        // const resOneByName = await fetch(
        //     `http://localhost:3000/file/oneByName?filename=${filename}&uuid=${missionUuid}`,
        //     {
        //         method: 'GET',
        //         headers: {
        //             cookie: `authtoken=${await getJwtToken(user)}`,
        //         },
        //     },
        // );

        // expect(resOneByName.status).toBe(200);
        // const jsonOneByName = await resOneByName.json();
        // expect(jsonOneByName).toBeDefined();
        // expect(jsonOneByName.uuid).toBeDefined();

        // // download file
        // // http://localhost:3000/file/download?uuid={uuid}
        // const resDownload = await fetch(
        //     `http://localhost:3000/file/download?uuid=${jsonOneByName.uuid}&expires=false`,
        //     {
        //         method: 'GET',
        //         headers: {
        //             cookie: `authtoken=${await getJwtToken(user)}`,
        //         },
        //     },
        // );

        // expect(resDownload.status).toBe(200);
        // const downloadFile = await resDownload.blob();

        // // verify file content
        // const downloadFileHash = await crypto.subtle.digest(
        //     'SHA-256',
        //     await downloadFile.arrayBuffer(),
        // );

        // expect(downloadFileHash).toEqual(fileHash);
    }, 30_000);

    test('Test if two files can be uploaded and downloaded in parallel', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if two files with the same name cannot be uploaded to the same mission', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if project can be renamed while uploading a file', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if mission can be renamed while uploading a file', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot upload file with arbitrary name', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot upload file to arbitrary bucket', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you can abort the upload, then retry', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you cannot download a file you should not have access to', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
