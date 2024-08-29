import { CreateProject } from '../../src/project/entities/create-project.dto';
import { get_jwt_token } from './database_utils';
import User from '@common/entities/user/user.entity';
import { CreateMission } from '../../src/mission/entities/create-mission.dto';
import QueueEntity from '@common/entities/queue/queue.entity';
import { FileState } from '@common/enum';
import * as fs from 'node:fs';
import { uploadFileMultipart } from './multipartUpload';
import { S3Client } from '@aws-sdk/client-s3';
const FormData = require('form-data');

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
    const json = await res.json();
    return json.uuid;
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
    const res = await fetch(`http://localhost:3000/file/temporaryAccess`, {
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
    const credentials = json['credentials'];
    const files = json['files'];
    expect(credentials).toBeDefined();
    expect(files).toBeDefined();
    const fileResponse = files[filename];
    expect(fileResponse).toBeDefined();
    expect(fileResponse['bucket']).toBe('bags');
    expect(fileResponse['fileUUID']).toBeDefined();
    expect(fileResponse['queueUUID']).toBeDefined();

    // open file from fixtures
    const file = fs.readFileSync(`./tests/fixtures/${filename}`);
    const blob = new Blob([file], {
        type: 'application/octet-stream',
    });
    const fileFile = Buffer.from(await blob.arrayBuffer());
    const file_hash = await crypto.subtle.digest('SHA-256', file.buffer);

    const minioClient = new S3Client({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        region: 'us-east-1',
        credentials: {
            accessKeyId: credentials.accessKey,
            secretAccessKey: credentials.secretKey,
            sessionToken: credentials.sessionToken,
        },
    });

    const resi = await uploadFileMultipart(
        fileFile,
        fileResponse['bucket'],
        fileResponse['location'],
        minioClient,
    );
    expect(resi).toBeDefined();

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
                uuid: fileResponse['queueUUID'],
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
                    x.uuid === fileResponse['queueUUID'] &&
                    x.state === FileState.COMPLETED,
            )
        ) {
            break;
        }

        await new Promise((r) => setTimeout(r, 1000));
    }

    return file_hash;
}
