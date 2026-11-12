import { UserEntity } from '@kleinkram/backend-common';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import { HeaderCreator } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';

/**
 * Storage usage and the list of action workers describe the shared
 * infrastructure. They are shown on the System page and may only be read by
 * users who may create projects (admins and members of an affiliation group).
 */
const SYSTEM_ENDPOINTS = ['/files/storage', '/workers'];

const get = async (path: string, user: UserEntity): Promise<Response> =>
    fetch(`${DEFAULT_URL}${path}`, {
        method: 'GET',
        headers: new HeaderCreator(user).getHeaders(),
    });

describe('System Endpoints Access', () => {
    setupDatabaseHooks();

    test.each(SYSTEM_ENDPOINTS)(
        'should return 403 Forbidden to an external user for %s',
        async (path) => {
            const { user } = await generateAndFetchDatabaseUser(
                'external',
                'user',
            );

            const response = await get(path, user);

            expect(response.status).toBe(403);
        },
    );

    test.each(SYSTEM_ENDPOINTS)(
        'should return 200 OK to an internal user for %s',
        async (path) => {
            const { user } = await generateAndFetchDatabaseUser(
                'internal',
                'user',
            );

            const response = await get(path, user);

            expect(response.status).toBe(200);
        },
    );

    test.each(SYSTEM_ENDPOINTS)(
        'should return 200 OK to an admin for %s',
        async (path) => {
            const { user } = await generateAndFetchDatabaseUser(
                'external',
                'admin',
            );

            const response = await get(path, user);

            expect(response.status).toBe(200);
        },
    );
});
