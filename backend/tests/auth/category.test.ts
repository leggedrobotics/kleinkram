import * as assert from 'node:assert';
import { createProjectUsingPost, HeaderCreator } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from './utilities';

interface CategoryTestResponse {
    uuid: string;
    name: string;
}

describe('Category API Endpoints', () => {
    setupDatabaseHooks();

    test('should create category successfully and return 201 Created', async () => {
        // Create user and project first
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const projectUuid = await createProjectUsingPost(
            {
                name: 'category_project',
                description: 'Project to test categories',
            },
            user,
        );

        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/categories`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                name: 'new_test_category',
                projectUUID: projectUuid,
            }),
        });

        assert.equal(
            response.status,
            201,
            `Category creation failed with status: ${response.status.toString()}`,
        );

        const body = (await response.json()) as CategoryTestResponse;
        assert.ok(typeof body.uuid === 'string', 'uuid should be a string');
        assert.equal(body.name, 'new_test_category', 'name should match');
    });
});
