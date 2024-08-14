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
                name: 'test project',
                description: 'test description',
                requiredTags: [],
            },
            user,
        );
        expect(project_uuid).toBeDefined();

        // create mission using the post
        const mission_uuid = await create_mission_using_post(
            {
                name: 'test mission',
                projectUUID: project_uuid,
                tags: {},
            },
            user,
        );
        expect(mission_uuid).toBeDefined();

        const file_hash = await upload_file(user, filename, mission_uuid);

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
                    docker_image: 'rslethz/action:latest',
                }),
            },
        );

        // check if the request was successful
        expect(action_submission.status).toBeLessThan(300);

        // get action uuid
        const action_uuid = await action_submission.text();
        expect(action_uuid).toBeDefined();

        let logs = null;
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
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        expect(logs).toBeDefined();
        const messages = logs.map((log) => log.message);
        const contains_file = messages.some((message) =>
            message.includes('test_small.mcap'),
        );
        expect(contains_file).toBeTruthy();

        // submit a new action
    }, 30_000);
});
