import { CreateProject } from '../../src/project/entities/create-project.dto';
import { getJwtToken } from './database_utils';
import User from '@common/entities/user/user.entity';
import { CreateMission } from '../../src/mission/entities/create-mission.dto';
import QueueEntity from '@common/entities/queue/queue.entity';
import { QueueState } from '@common/frontend_shared/enum';
import * as fs from 'node:fs';
import { uploadFileMultipart } from './multipartUpload';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const createProjectUsingPost = async (
    project: CreateProject,
    user: User,
): Promise<string> => {
    const res = await fetch(`http://localhost:3000/project/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${getJwtToken(user)}`,
        },
        body: JSON.stringify(project),
        credentials: 'include',
    });

    // check if the request was successful
    expect(res.status).toBeLessThan(300);
    return (await res.json()).uuid;
};

export const createMissionUsingPost = async (
    mission: CreateMission,
    user: User,
): Promise<string> => {
    const res = await fetch(`http://localhost:3000/mission/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${getJwtToken(user)}`,
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
 * @param missionUuid the mission uuid to upload the file to
 *
 * @returns the has of the file computed using SHA-256 (and the local file)
 *
 */
export async function uploadFile(
    user: User,
    filename: string,
    missionUuid: string,
) {
    const res = await fetch(`http://localhost:3000/file/temporaryAccess`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${await getJwtToken(user)}`,
        },
        body: JSON.stringify({
            filenames: [filename],
            missionUUID: missionUuid,
        }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toBeDefined();

    const fileResponse = json[0];

    expect(fileResponse).toBeDefined();
    expect(fileResponse.bucket).toBe('bags');
    expect(fileResponse.fileUUID).toBeDefined();

    // open file from fixtures
    const file = fs.readFileSync(`./tests/fixtures/${filename}`);
    const blob = new Blob([file], {
        type: 'application/octet-stream',
    });
    const fileFile = Buffer.from(await blob.arrayBuffer());
    const fileHash = await crypto.subtle.digest('SHA-256', fileFile);
    const hash = crypto.createHash('md5');
    hash.update(fileFile);

    const minioClient = new S3Client({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        region: 'us-east-1',
        credentials: {
            accessKeyId: fileResponse.accessCredentials.accessKey,
            secretAccessKey: fileResponse.accessCredentials.secretKey,
            sessionToken: fileResponse.accessCredentials.sessionToken,
        },
    });

    const resi = await uploadFileMultipart(
        fileFile,
        fileResponse.bucket,
        fileResponse.fileUUID,
        minioClient,
    );
    expect(resi).toBeDefined();

    // confirm upload
    // http://localhost:3000/queue/confirmUpload
    const resConfirm = await fetch(
        `http://localhost:3000/queue/confirmUpload`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: `authtoken=${await getJwtToken(user)}`,
            },
            body: JSON.stringify({
                uuid: fileResponse.fileUUID,
                md5: hash.digest('base64'),
            }),
        },
    );
    expect(resConfirm.status).toBe(201);

    while (true) {
        const resActive = await fetch(`http://localhost:3000/queue/active`, {
            method: 'GET',
            headers: {
                cookie: `authtoken=${await getJwtToken(user)}`,
            },
        });

        expect(resActive.status).toBe(200);
        const active = await resActive.json();
        if (
            active.find(
                (x: QueueEntity) =>
                    x.uuid === fileResponse.queueUUID &&
                    x.state === QueueState.COMPLETED,
            )
        ) {
            break;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }

    return fileHash;
}
