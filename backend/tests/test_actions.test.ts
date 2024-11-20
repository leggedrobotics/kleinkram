import {
    clearAllData,
    db,
    getJwtToken,
    getUserFromDb,
    mockDbUser,
} from './utils/database_utils';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    uploadFile,
} from './utils/api_calls';
import { AccessGroupRights, ActionState } from '@common/frontend_shared/enum';
import { SubmitAction } from '../src/action/entities/submit_action.dto';

describe('Verify Action', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    test('Test if file is uploaded and can be downloaded again inside an action', async () => {
        const filename = 'test_small.bag';

        const userId = await mockDbUser('internal@leggedrobotics.com');
        const user = await getUserFromDb(userId);
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
                    cookie: `authtoken=${await getJwtToken(user)}`,

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
                    cookie: `authtoken=${await getJwtToken(user)}`,

                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    missionUUID: missionUuid,
                    templateUUID: uuid,
                } as SubmitAction),
            },
        );

        // check if the request was successful
        expect(actionSubmission.status).toBeLessThan(300);

        // get action uuid
        const action = await actionSubmission.json();
        const actionUuid = action.uuid;
        expect(actionUuid).toBeDefined();
        let logs = null;
        await new Promise((resolve) => setTimeout(resolve, 2000));

        while (true) {
            const _res = await fetch(
                `http://localhost:3000/action/details?uuid=${actionUuid}`,
                {
                    method: 'GET',
                    headers: {
                        cookie: `authtoken=${await getJwtToken(user)}`,
                    },
                },
            );

            const json = await _res.json();
            if (
                json.state === ActionState.DONE ||
                json.state === ActionState.FAILED
            ) {
                logs = json.logs;
                console.log('exiting: ', json.state);
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const fileHashStr = Buffer.from(fileHash).toString('hex');
        console.log(fileHashStr);

        expect(logs).toBeDefined();
        const messages = logs?.map((log) => log.message) ?? [];
        console.log(messages);
        const containsFile = messages.some((message) =>
            message.includes(fileHashStr),
        );
        expect(containsFile).toBeTruthy();

        // submit a new action
    }, 30_000);

    test('if you can upload a file within an action', () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
