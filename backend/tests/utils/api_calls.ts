import { CreateProject } from '../../src/project/entities/create-project.dto';
import { get_jwt_token } from './database_utils';
import User from '@common/entities/user/user.entity';
import { CreateMission } from '../../src/mission/entities/create-mission.dto';
import QueueEntity from '@common/entities/queue/queue.entity';
import { FileState } from '@common/enum';
import * as fs from 'node:fs';

export const create_project_using_post = async (
    project: CreateProject,
    user?: User,
): Promise<string> => {
    const res = await fetch(`http://localhost:3000/project/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${await get_jwt_token(user)}`,
        },
        body: JSON.stringify(project),
        credentials: 'include',
    });

    // check if the request was successful
    expect(res.status).toBeLessThan(300);
    return (await res.json()).uuid;
};

export const create_mission_using_post = async (
    mission: CreateMission,
    user?: User,
): Promise<string> => {
    const res = await fetch(`http://localhost:3000/mission/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${await get_jwt_token(user)}`,
        },
        body: JSON.stringify({
            name: mission.name,
            projectUUID: mission.projectUUID,
            tags: {},
        }),
        credentials: 'include',
    });

    // check if the request was successful
    expect(res.status).toBeLessThan(300);
    return (await res.json()).uuid;
};

/**
 *
 * Uploads a file using the API.
 *
 *
 * @param user the user that is uploading the file
 * @param filename the name of the file to upload
 * @param mission_uuid the mission uuid to upload the file to
 *
 * @returns the has of the file computed using SHA-256 (and the local file)
 *
 */
export async function upload_file(
    user: User,
    filename: string,
    mission_uuid: string,
) {
    // http://localhost:3000/queue/createPreSignedURLS
    const res = await fetch(`http://localhost:3000/queue/createPreSignedURLS`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${await get_jwt_token(user)}`,
        },
        body: JSON.stringify({
            filenames: [filename],
            missionUUID: mission_uuid,
        }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
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
        const res_active = await fetch(`http://localhost:3000/queue/active`, {
            method: 'GET',
            headers: {
                cookie: `authtoken=${await get_jwt_token(user)}`,
            },
        });

        expect(res_active.status).toBe(200);
        const active = await res_active.json();
        if (
            active.find(
                (x: QueueEntity) =>
                    x.uuid === json[filename].uuid &&
                    x.state === FileState.COMPLETED,
            )
        ) {
            break;
        }

        await new Promise((r) => setTimeout(r, 1000));
    }

    return file_hash;
}
