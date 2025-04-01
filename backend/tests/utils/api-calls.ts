import { CreateMission } from '@common/api/types/create-mission.dto';

import QueueEntity from '@common/entities/queue/queue.entity';
import { QueueState } from '@common/frontend_shared/enum';

import { S3Client } from '@aws-sdk/client-s3';
import { CreateAccessGroupDto } from '@common/api/types/create-access-group.dto';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import { CreateProject } from '../../../common/api/types/create-project.dto';
import { CreateTagTypeDto } from '../../../common/api/types/tags/create-tag-type.dto';
import User from '../../../common/entities/user/user.entity';
import { DEFAULT_URL } from '../auth/utilities';
import { database, getJwtToken } from './database-utilities';
import { uploadFileMultipart } from './multipartUpload';

export class HeaderCreator {
    headers: Headers;
    /**
     * Creates a HeadersBuilder instance and initializes headers.
     *
     * @param {User} user - The authenticated user whose token is used in headers.
     */
    constructor(user?: User) {
        this.headers = new Headers();

        if (user) {
            this.headers.append('cookie', `authtoken=${getJwtToken(user)}`);
        }
        // used to avoid usage of older versions of kleinkram
        this.headers.append('kleinkram-client-version', '0.43.0');
    }

    /**
     * Adds a custom header to the request.
     *
     * @param {string} key - The name of the header.a
     * @param {string} value - The value of the header.
     */
    addHeader(key: string, value: string) {
        this.headers.append(key, value);
    }
    /**
     * Retrieves the headers object.
     *
     * @returns {Headers} - The Headers object containing all request headers.
     */
    getHeaders(): Headers {
        return this.headers;
    }
}

/**
 * Sends a POST request to create a new project on the backend server.
 *
 * @param {CreateProject} project - The project data to be created.
 * @param {User} user -             The authenticated user requesting the project creation.
 * @returns {Promise<string>} -     A promise that responseolves to the UUID of the created project.
 *
 * @throws {Error} -                Throws an error if the request fails or returns a non-2xx status code.
 */
export const createProjectUsingPost = async (
    project: CreateProject,
    user: User,
): Promise<string> => {
    // generate header
    const headersBuilder = new HeaderCreator(user);
    headersBuilder.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}/project`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify(project),
        credentials: 'include',
    });

    const json = await response.json();
    console.log(`['DEBUG'] Created project:`, json);
    expect(response.status).toBeLessThan(300);
    return json.uuid;
};

export const createMissionUsingPost = async (
    mission: CreateMission,
    user: User,
): Promise<string> => {
    // create header
    const headersBuilder = new HeaderCreator(user);
    headersBuilder.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}/mission/create`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify({
            name: mission.name,
            projectUUID: mission.projectUUID,
            tags: {},
        }),
        credentials: 'include',
    });

    // check if the request was successful
    expect(response.status).toBeLessThan(300);
    const json = await response.json();
    console.log(`['DEBUG'] Created mission:`, json);
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
): Promise<ArrayBuffer> {
    const response = await fetch(`${DEFAULT_URL}/file/temporaryAccess`, {
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

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json).toBeDefined();

    const fileresponseponse = json[0];

    expect(fileresponseponse).toBeDefined();
    expect(fileresponseponse.bucket).toBe('bags');
    expect(fileresponseponse.fileUUID).toBeDefined();

    // open file from fixturesponse
    const file = fs.readFileSync(`./tests/fixturesponse/${filename}`);
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
            accessKeyId: fileresponseponse.accessCredentials.accessKey,
            secretAccessKey: fileresponseponse.accessCredentials.secretKey,
            sessionToken: fileresponseponse.accessCredentials.sessionToken,
        },
    });

    const responsei = await uploadFileMultipart(
        fileFile,
        fileresponseponse.bucket,
        fileresponseponse.fileUUID,
        minioClient,
    );
    expect(responsei).toBeDefined();

    // confirm upload
    // http://localhost:3000/queue/confirmUpload
    const responseConfirm = await fetch(
        `${DEFAULT_URL}/queue/confirmUpload`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: `authtoken=${await getJwtToken(user)}`,
            },
            body: JSON.stringify({
                uuid: fileresponseponse.fileUUID,
                md5: hash.digest('base64'),
            }),
        },
    );
    expect(responseConfirm.status).toBe(201);

    while (true) {
        const responseActive = await fetch(`${DEFAULT_URL}/queue/active`, {
            method: 'GET',
            headers: {
                cookie: `authtoken=${await getJwtToken(user)}`,
            },
        });

        expect(responseActive.status).toBe(200);
        const active = await responseActive.json();
        if (
            active.some(
                (x: QueueEntity) =>
                    x.uuid === fileresponseponse.queueUUID &&
                    x.state === QueueState.COMPLETED,
            )
        ) {
            break;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }

    return fileHash;
}

export const createMetadataUsingPost = async (
    tagType: CreateTagTypeDto,
    user: User,
): Promise<string> => {
    const headersBuilder = new HeaderCreator(user);
    headersBuilder.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}/tag/create`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify({
            name: tagType.name,
            type: tagType.type,
        }),
    });

    const json = await response.json();
    console.log(`['DEBUG'] Created tag:`, json);
    expect(response.status).toBeLessThan(300);
    return json.uuid;
};

export const createAccessGroupUsingPost = async (
    accessGroup: CreateAccessGroupDto,
    creator: User,
    // accessGroupType: AccessGroupType,
    userList: [User],
): Promise<string> => {
    const headersBuilder = new HeaderCreator(creator);
    headersBuilder.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}/access/create`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify({
            name: accessGroup.name,
        }),
    });

    // get access group
    const testAccesGroup = await database
        .getRepository<AccessGroup>('AccessGroup')
        .findOneOrFail({ where: { name: accessGroup.name } });

    const groupJson = await response.json();
    expect(response.status).toBeLessThan(300);
    console.log(`['DEBUG'] Created access group:`, testAccesGroup.uuid);

    // add users to access group
    await Promise.all(
        userList.map(async (user) => {
            const groupResponse = await fetch(
                `${DEFAULT_URL}/access/addUserToAccessGroup`,
                {
                    method: 'POST',
                    headers: headersBuilder.getHeaders(),
                    body: JSON.stringify({
                        userUUID: user.uuid,
                        uuid: testAccesGroup.uuid,
                    }),
                },
            );
            expect(groupResponse.status).toBeLessThan(300);
            const json = await groupResponse.json();
            console.log(
                `['DEBUG'] Added user ${user.uuid} to access group:`,
                json,
            );
        }),
    );

    console.log(`['DEBUG'] Users added to access group:`, groupJson);

    return testAccesGroup.uuid;
};
