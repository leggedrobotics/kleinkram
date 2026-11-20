import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import * as assert from 'node:assert';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import { createProjectUsingPost, HeaderCreator } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';

const request = async (
    user: UserEntity,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; message: unknown; body: unknown }> => {
    const headers = new HeaderCreator(user);
    if (body !== undefined)
        headers.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: headers.getHeaders(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = (await response.json()) as { message?: unknown };
    return { status: response.status, message: json.message, body: json };
};

describe('Request Input Hardening', () => {
    setupDatabaseHooks();

    test('should return 400 if the body contains a NUL character', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const projectUuid = await createProjectUsingPost(
            { name: 'nul_body_project', description: 'NUL in body' },
            user,
        );

        const response = await request(user, 'POST', '/categories', {
            name: 'raw\u0000data',
            projectUUID: projectUuid,
        });

        assert.equal(response.status, 400);
        assert.equal(response.message, 'Text must not contain NUL characters');
    });

    test('should return 400 if the query or the path contains a NUL character', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const inQuery = await request(
            user,
            'GET',
            '/users/search?search=a%00b',
        );
        const inPath = await request(user, 'GET', '/triggers/a%00b');

        assert.equal(inQuery.status, 400);
        assert.equal(inPath.status, 400);
        assert.equal(inPath.message, 'Text must not contain NUL characters');
    });

    test('should return 400 if skip is larger than the database can handle', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const response = await request(
            user,
            'GET',
            '/topics?skip=100000000000000000000',
        );

        assert.equal(response.status, 400);
    });

    test('should return 400 if a guard reads file uuids that are not an array', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const response = await request(user, 'POST', '/files/copy', {
            fileUUIDs: '0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b',
            missionUUID: '0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b',
        });

        assert.equal(response.status, 400);
        assert.equal(response.message, 'fileUUIDs must be an array of UUIDs');
    });

    test('should return 409 if a unique constraint is violated', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        await request(user, 'POST', '/access-groups', { name: 'twin_group' });

        const response = await request(user, 'POST', '/access-groups', {
            name: 'twin_group',
        });

        assert.equal(response.status, 409);
    });

    // A delete blocked by a foreign key (23503) maps to 409; that mapping is
    // covered in database-error-mapping.unit.test.ts. Deleting an access
    // group no longer hits it: its project access is removed with it.
});
