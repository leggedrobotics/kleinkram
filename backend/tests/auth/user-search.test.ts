import * as assert from 'node:assert';
import { HeaderCreator } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from './utilities';

interface UserTestDto {
    uuid: string;
    name: string;
    avatarUrl: string | null;
    email: string | null;
}

interface UsersTestResponse {
    users: UserTestDto[];
    count: number;
}

describe('User Search API Endpoint', () => {
    setupDatabaseHooks();

    test('should search users successfully and return 200 OK with valid UsersDto schema', async () => {
        // Create an internal user to authenticate and search with
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const searchString = 'internal';
        const response = await fetch(
            `${DEFAULT_URL}/users/search?search=${searchString}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        assert.equal(
            response.status,
            200,
            `User search endpoint failed with status: ${response.status.toString()}`,
        );

        const body = (await response.json()) as UsersTestResponse;
        assert.ok(
            Array.isArray(body.users),
            'users property should be an array',
        );
        assert.ok(
            typeof body.count === 'number',
            'count property should be a number',
        );
        assert.ok(body.count >= 1, 'count should be at least 1');

        const foundUser = body.users.find((u) => u.uuid === user.uuid);
        assert.ok(
            foundUser,
            'The created user should be present in search results',
        );
        assert.equal(foundUser.name, user.name, 'Name should match');
        assert.equal(foundUser.uuid, user.uuid, 'UUID should match');
    });
});
