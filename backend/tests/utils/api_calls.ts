import { getJwtToken } from './database_utils';

import { CreateMission } from '@common/api/types/create-mission.dto';
import QueueEntity from '@common/entities/queue/queue.entity';
import { QueueState } from '@common/frontend_shared/enum';
import * as fs from 'node:fs';
import { uploadFileMultipart } from './multipartUpload';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { CreateProject } from '../../../common/api/types/create-project.dto';
import User from '../../../common/entities/user/user.entity';


export class HeaderCreator {
    headers: Headers;
    /**
     * Creates a HeadersBuilder instance and initializes headers.
     * 
     * @param {User} user - The authenticated user whose token is used in headers.
     * @param {string} jwtToken - (Optional) JWT token string for authentication.
     */
    constructor(user?: User, JwtToken?: string) {
        this.headers = new Headers();
        
        if (JwtToken) {
            this.headers.append('cookie', `authtoken=${JwtToken}`);
        } else if (user) {
            this.headers.append('cookie', `authtoken=${getJwtToken(user)}`);
        } else {
            throw new Error("Either JwtToken or a valid User must be provided.");
        }
        // used to avoid usage of older versions of kleinkram
        this.headers.append('kleinkram-client-version', '0.42.0');
    }  
    
    /**
     * Adds a custom header to the request.
     * 
     * @param {string} key - The name of the header.a
     * @param {string} value - The value of the header.
     */
    addHeader(key:string, value:string) {
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
 * @returns {Promise<string>} -     A promise that resolves to the UUID of the created project.
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

    const res = await fetch(`http://localhost:3000/project`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
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
