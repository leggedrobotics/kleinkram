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
import { ActionState } from '@common/enum';
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
                name: 'test_mission',
                projectUUID: project_uuid,
                tags: {},
            },
            user,
        );
        expect(mission_uuid).toBeDefined();

        const file_hash = await upload_file(user, filename, mission_uuid);

        const create_template = await fetch(
            `http://localhost:3000/action/createTemplate`,
            {
                method: 'POST',
                headers: {
                    cookie: `authtoken=${await get_jwt_token(user)}`,
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
                }),
            },
        );

        expect(create_template.status).toBeLessThan(300);
        const res = await create_template.json();
        const uuid = res.uuid;

        // start action container
        const action_submission = await fetch(
            `http://localhost:3000/action/submit`,
            {
                method: 'POST',
                headers: {
                    cookie: `authtoken=${await get_jwt_token(user)}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    missionUUID: mission_uuid,
                    templateUUID: uuid,
                } as SubmitAction),
            },
        );

        // check if the request was successful
        expect(action_submission.status).toBeLessThan(300);

        // get action uuid
        const action = await action_submission.json();
        const action_uuid = action.uuid;
        expect(action_uuid).toBeDefined();
        let logs = null;
        await new Promise((resolve) => setTimeout(resolve, 2000));

        while (true) {
            const res = await fetch(
                `http://localhost:3000/action/details?uuid=${action_uuid}`,
                {
                    method: 'GET',
                    headers: {
                        cookie: `authtoken=${await get_jwt_token(user)}`,
                    },
                },
            );

            const json = await res.json();
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

        const file_hash_str = Buffer.from(file_hash).toString('hex');

        expect(logs).toBeDefined();
        const messages = logs.map((log) => log.message);
        console.log(messages);
        const contains_file = messages.some((message) =>
            message.includes(file_hash_str),
        );
        expect(contains_file).toBeTruthy();

        // submit a new action
    }, 30_000);
});
