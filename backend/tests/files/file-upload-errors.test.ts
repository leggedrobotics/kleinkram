import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { DEFAULT_URL } from '../auth/utilities';
import { createProjectUsingPost, getAuthHeaders } from '../utils/api-calls';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const send = async (
    user: UserEntity,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; json: unknown }> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
        status: response.status,
        json: text === '' ? undefined : (JSON.parse(text) as unknown),
    };
};

const messageOf = (json: unknown): unknown =>
    (json as { message?: unknown }).message;

/** Reserves an upload, which creates the file without sending any data. */
const reserveUpload = async (
    user: UserEntity,
    missionUuid: string,
    filename: string,
): Promise<string> => {
    const response = await send(user, 'POST', '/files/temporaryAccess', {
        filenames: [filename],
        missionUUID: missionUuid,
    });
    expect(response.status).toBeLessThan(300);
    return (response.json as { data: { fileUUID: string }[] }).data[0]
        ?.fileUUID as string;
};

describe('File Upload Errors', () => {
    setupDatabaseHooks();

    test('should move a mission whose upload never finished', async () => {
        const { user, missionUuid } = await setupTestEnvironment();
        await reserveUpload(user, missionUuid, 'never_uploaded.bag');
        const targetProject = await createProjectUsingPost(
            { name: 'move_target', description: 'target' },
            user,
        );

        const response = await send(
            user,
            'POST',
            `/missions/${missionUuid}/move?projectUUID=${targetProject}`,
        );

        expect(response.status).toBeLessThan(300);
        const mission = await send(user, 'GET', `/missions/${missionUuid}`);
        expect(
            (mission.json as { project: { uuid: string } }).project.uuid,
        ).toBe(targetProject);
    });

    test('should return 409 if an upload is confirmed but its data never arrived', async () => {
        const { user, missionUuid } = await setupTestEnvironment();
        const fileUuid = await reserveUpload(user, missionUuid, 'ghost.bag');

        const response = await send(user, 'POST', '/files/upload/confirm', {
            uuid: fileUuid,
            md5: 'd41d8cd98f00b204e9800998ecf8427e',
        });

        expect(response.status).toBe(409);
        expect(messageOf(response.json)).toBe(
            'File not found in storage. Upload it again.',
        );
    });

    test('should return 404 if no file has the requested name', async () => {
        const { user, missionUuid } = await setupTestEnvironment();

        const response = await send(
            user,
            'GET',
            `/files/oneByName?uuid=${missionUuid}&filename=missing.bag`,
        );

        expect(response.status).toBe(404);
    });

    test('should return 400 if the queue state filter is not a queue state', async () => {
        const { user } = await setupTestEnvironment();

        const invalid = await send(
            user,
            'GET',
            '/files/queue?startDate=2020-01-01T00:00:00.000Z&stateFilter=abc',
        );
        const valid = await send(
            user,
            'GET',
            '/files/queue?startDate=2020-01-01T00:00:00.000Z&stateFilter=10,20',
        );

        expect(invalid.status).toBe(400);
        expect(String(messageOf(invalid.json))).toContain('stateFilter');
        expect(valid.status).toBe(200);
    });

    test('should return 400 if a metadata filter value does not match its type', async () => {
        const { user } = await setupTestEnvironment();
        const created = await send(user, 'POST', '/metadata-types', {
            name: 'speed',
            type: 'NUMBER',
        });
        const typeUuid = (created.json as { uuid: string }).uuid;
        const filter = (value: string): string =>
            encodeURIComponent(JSON.stringify({ [typeUuid]: value }));

        const invalid = await send(
            user,
            'GET',
            `/files?metadataByTypeUuid=${filter('abc')}`,
        );
        const valid = await send(
            user,
            'GET',
            `/files?metadataByTypeUuid=${filter('1.5')}`,
        );

        expect(invalid.status).toBe(400);
        expect(messageOf(invalid.json)).toBe(
            'Metadata "speed" must be a number',
        );
        expect(valid.status).toBe(200);
    });
});
