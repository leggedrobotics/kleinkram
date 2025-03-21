import {
    clearAllData,
    db as database,
    getJwtToken,
    getUserFromDb as getUserFromDatabase,
    mockDbUser as mockDatabaseUser,
} from '../utils/database_utils';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    uploadFile,
} from '../utils/api_calls';
import { AccessGroupRights, ActionState } from '@common/frontend_shared/enum';

import { SubmitActionDto } from '../../../common/api/types/submit-action-response.dto';

describe('Verify Action', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // file handling tests
    test('if file is uploaded and can be downloaded again inside an action', async () => {
        const filename = 'test_small.bag';

        const userId = await mockDatabaseUser('internal@leggedrobotics.com');
        const user = await getUserFromDatabase(userId);
        // create project
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'test description',
                requiredTags: [],
            },
            user,
        );
        expect(projectUuid).toBeDefined();

        // create mission using the post
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );
        expect(missionUuid).toBeDefined();

        const fileHash = await uploadFile(user, filename, missionUuid);

        const createTemplate = await fetch(
            `http://localhost:3000/action/createTemplate`,
            {
                method: 'POST',
                headers: {
                    cookie: `authtoken=${getJwtToken(user)}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'test-template',
                    command: '',
                    image: 'rslethz/action:file-hash-latest',
                    cpuCores: 2,
                    cpuMemory: 2,
                    gpuMemory: -1,
                    maxRuntime: 2,
                    searchable: true,
                    accessRights: AccessGroupRights.READ,
                }),
            },
        );

        expect(createTemplate.status).toBeLessThan(300);
        const res = await createTemplate.json();
        const uuid = res.uuid;

        // start action container
        const actionSubmission = await fetch(
            `http://localhost:3000/action/submit`,
            {
                method: 'POST',
                headers: {
                    cookie: `authtoken=${getJwtToken(user)}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    missionUUID: missionUuid,
                    templateUUID: uuid,
                } as SubmitActionDto),
            },
        );

        // check if the request was successful
        expect(actionSubmission.status).toBeLessThan(300);

        // get action uuid
        const action = await actionSubmission.json();
        const actionUuid: string = action.uuid;
        expect(actionUuid).toBeDefined();
        let logs: any[] = [];
        await new Promise((resolve) => setTimeout(resolve, 2000));

        while (true) {
            const _res = await fetch(
                `http://localhost:3000/action/details?uuid=${actionUuid}`,
                {
                    method: 'GET',
                    headers: {
                        cookie: `authtoken=${getJwtToken(user)}`,
                    },
                },
            );

            const json = await _res.json();
            if (
                json.state === ActionState.DONE ||
                json.state === ActionState.FAILED
            ) {
                logs = json.logs;
                console.log('exiting:', json.state);
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const fileHashString = Buffer.from(fileHash).toString('hex');
        console.log(fileHashString);

        expect(logs).toBeDefined();
        const messages = logs.map((log) => log.message) ?? [];
        console.log(messages);
        const containsFile = messages.some((message) =>
            message.includes(fileHashString),
        );
        expect(containsFile).toBeTruthy();

        // submit a new action
    }, 30_000);

    test('if you can upload a file within an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you can load an existing action and submit it', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you can load an existing action and save it as a new version', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if you can view details of an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

        // user: read access
    test('if a user with read (viewer) access on a mission can view an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });   

    test('if a user with read access (viewer) on a mission can not create an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // test('if a user with read access (viewer) cannot cancel an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    test('if a user with read access (viewer) cannot delete an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

        // user: create/edit access
    test('if a user with edit/create access (creator) on a mission can create an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // test('if a user with edit/create access (creator) on a mission cannot cancel an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    test('if a user with edit/create access (creator) on a mission can delete an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

        // admin
    test('if a admin can view details of any action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if a admin can create an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    // test('if a admin can cancel any action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    test('if a admin can delete any action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

});
