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
} from './utils/api_calls';
import * as fs from 'node:fs';
import QueueEntity from '@common/entities/queue/queue.entity';

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

        // http://localhost:3000/queue/createPreSignedURLS
        const res = await fetch(
            `http://localhost:3000/queue/createPreSignedURLS`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${await get_jwt_token(user)}`,
                },
                body: JSON.stringify({
                    filenames: [filename],
                    missionUUID: mission_uuid,
                }),
            },
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        console.log(json);
        const upload_url = json[filename].url;
        expect(upload_url).toBeDefined();

        // open file from fixtures
        const file = fs.readFileSync(`./tests/fixtures/${filename}`);
        const file_hash = await crypto.subtle.digest('SHA-256', file.buffer);

        // upload file
        const upload_res = await fetch(upload_url, {
            method: 'PUT',
            body: file,
        });

        expect(upload_res.status).toBe(200);

        // confirm upload
        // http://localhost:3000/queue/confirmUpload
        const res_confirm = await fetch(
            `http://localhost:3000/queue/confirmUpload`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${await get_jwt_token(user)}`,
                },
                body: JSON.stringify({
                    uuid: json[filename].uuid,
                }),
            },
        );
        expect(res_confirm.status).toBe(201);

        while (true) {
            const res_active = await fetch(
                `http://localhost:3000/queue/active`,
                {
                    method: 'GET',
                    headers: {
                        cookie: `authtoken=${await get_jwt_token(user)}`,
                    },
                },
            );

            expect(res_active.status).toBe(200);
            const active = await res_active.json();
            if (
                active.find(
                    (x: QueueEntity) =>
                        x.uuid === json[filename].uuid && x.state === 'DONE',
                )
            ) {
                break;
            }

            await new Promise((r) => setTimeout(r, 1000));
        }

        // get file uuid by calling /ile/oneByName
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
    });
});
