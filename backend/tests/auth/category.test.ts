import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import * as assert from 'node:assert';
import { createProjectUsingPost, HeaderCreator } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from './utilities';

interface CategoryTestResponse {
    uuid: string;
    name: string;
    description: string;
}

interface CategoryListTestResponse {
    count: number;
    data: CategoryTestResponse[];
}

const createCategory = async (
    user: UserEntity,
    projectUuid: string,
    name: string,
    description?: string,
): Promise<CategoryTestResponse> => {
    const headersBuilder = new HeaderCreator(user);
    headersBuilder.addHeader('Content-Type', 'application/json');

    const response = await fetch(`${DEFAULT_URL}/categories`, {
        method: 'POST',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify({
            name,
            projectUUID: projectUuid,
            ...(description === undefined ? {} : { description }),
        }),
    });

    assert.equal(
        response.status,
        201,
        `Category creation failed with status: ${response.status.toString()}`,
    );

    return (await response.json()) as CategoryTestResponse;
};

const updateDescription = async (
    user: UserEntity,
    categoryUuid: string,
    projectUuid: string,
    description: string,
): Promise<Response> => {
    const headersBuilder = new HeaderCreator(user);
    headersBuilder.addHeader('Content-Type', 'application/json');

    return fetch(`${DEFAULT_URL}/categories/${categoryUuid}`, {
        method: 'PUT',
        headers: headersBuilder.getHeaders(),
        body: JSON.stringify({
            projectUUID: projectUuid,
            description,
        }),
    });
};

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
        assert.equal(
            body.description,
            '',
            'description should default to an empty string',
        );
    });

    test('should store the description of a newly created category', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const projectUuid = await createProjectUsingPost(
            {
                name: 'category_description_project',
                description: 'Project to test category descriptions',
            },
            user,
        );

        const category = await createCategory(
            user,
            projectUuid,
            'described_category',
            'All files recorded in the forest',
        );

        assert.equal(
            category.description,
            'All files recorded in the forest',
            'description should match',
        );

        const listResponse = await fetch(
            `${DEFAULT_URL}/categories?projectUuid=${projectUuid}`,
            { headers: new HeaderCreator(user).getHeaders() },
        );
        assert.equal(listResponse.status, 200);

        const list = (await listResponse.json()) as CategoryListTestResponse;
        const listed = list.data.find((c) => c.uuid === category.uuid);
        assert.equal(
            listed?.description,
            'All files recorded in the forest',
            'listed category should expose the description',
        );
    });

    test('should update the description of an existing category', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const projectUuid = await createProjectUsingPost(
            {
                name: 'category_update_project',
                description: 'Project to test category description updates',
            },
            user,
        );

        const category = await createCategory(
            user,
            projectUuid,
            'category_without_description',
        );

        const response = await updateDescription(
            user,
            category.uuid,
            projectUuid,
            'Added later on',
        );

        assert.equal(
            response.status,
            200,
            `Description update failed with status: ${response.status.toString()}`,
        );

        const body = (await response.json()) as CategoryTestResponse;
        assert.equal(body.uuid, category.uuid, 'uuid should match');
        assert.equal(body.name, 'category_without_description');
        assert.equal(body.description, 'Added later on');
    });

    test('should return 404 if the category does not belong to the given project', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const projectUuid = await createProjectUsingPost(
            {
                name: 'category_owner_project',
                description: 'Project owning the category',
            },
            user,
        );
        const otherProjectUuid = await createProjectUsingPost(
            {
                name: 'category_other_project',
                description: 'Project not owning the category',
            },
            user,
        );

        const category = await createCategory(
            user,
            projectUuid,
            'foreign_category',
        );

        const response = await updateDescription(
            user,
            category.uuid,
            otherProjectUuid,
            'Should not be applied',
        );

        assert.equal(
            response.status,
            404,
            `Expected 404, got: ${response.status.toString()}`,
        );
    });
});
