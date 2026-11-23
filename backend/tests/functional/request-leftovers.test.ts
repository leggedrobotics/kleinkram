import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
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

/** Reserves an upload, which creates a file in the mission. */
const createFile = async (
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

const createCategory = async (
    user: UserEntity,
    projectUuid: string,
    name: string,
): Promise<string> => {
    const response = await send(user, 'POST', '/categories', {
        name,
        projectUUID: projectUuid,
    });
    expect(response.status).toBe(201);
    return (response.json as { uuid: string }).uuid;
};

const setupCategoryFixtures = async (): Promise<{
    user: UserEntity;
    missionUuid: string;
    fileUuid: string;
    categoryUuid: string;
}> => {
    const { user, projectUuid, missionUuid } = await setupTestEnvironment();
    const fileUuid = await createFile(user, missionUuid, 'run.bag');
    const categoryUuid = await createCategory(user, projectUuid, 'Raw Data');
    return { user, missionUuid, fileUuid, categoryUuid };
};

describe('Request Leftovers', () => {
    setupDatabaseHooks();

    test('should accept a single action state and reject unknown ones', async () => {
        const { user } = await setupTestEnvironment();

        const single = await send(user, 'GET', '/actions?states=PROCESSING');
        const list = await send(user, 'GET', '/actions?states=DONE,FAILED');
        const empty = await send(user, 'GET', '/actions?states=');
        const unknown = await send(user, 'GET', '/actions?states=done');

        expect(single.status).toBe(200);
        expect(list.status).toBe(200);
        expect(empty.status).toBe(200);
        expect(unknown.status).toBe(400);
        expect(String(messageOf(unknown.json))).toContain('PROCESSING');
    });

    describe('adding categories to files', () => {
        test('should add a category of the project', async () => {
            const { user, missionUuid, fileUuid, categoryUuid } =
                await setupCategoryFixtures();

            const response = await send(user, 'POST', '/categories/add-many', {
                missionUUID: missionUuid,
                files: [fileUuid],
                categories: [categoryUuid],
            });

            expect(response.status).toBeLessThan(300);
        });

        test('should return 400 if a file is not in the mission', async () => {
            const { user, missionUuid, categoryUuid } =
                await setupCategoryFixtures();
            const otherProject = await createProjectUsingPost(
                { name: 'other_files_project', description: 'other' },
                user,
            );
            const otherMission = await createMissionUsingPost(
                {
                    name: 'other_mission',
                    projectUUID: otherProject,
                    metadata: {},
                    ignoreMissingMetadata: true,
                },
                user,
            );
            const foreignFile = await createFile(
                user,
                otherMission,
                'foreign_run.bag',
            );

            const response = await send(user, 'POST', '/categories/add-many', {
                missionUUID: missionUuid,
                files: [foreignFile],
                categories: [categoryUuid],
            });

            expect(response.status).toBe(400);
        });

        test('should return 404 if a category does not exist', async () => {
            const { user, missionUuid, fileUuid } =
                await setupCategoryFixtures();

            const response = await send(user, 'POST', '/categories/add-many', {
                missionUUID: missionUuid,
                files: [fileUuid],
                categories: ['0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b'],
            });

            expect(response.status).toBe(404);
        });

        test('should return 400 if a category belongs to another project', async () => {
            const { user, missionUuid, fileUuid } =
                await setupCategoryFixtures();
            const otherProject = await createProjectUsingPost(
                { name: 'other_category_project', description: 'other' },
                user,
            );
            const foreignCategory = await createCategory(
                user,
                otherProject,
                'Foreign',
            );

            const response = await send(user, 'POST', '/categories/add-many', {
                missionUUID: missionUuid,
                files: [fileUuid],
                categories: [foreignCategory],
            });

            expect(response.status).toBe(400);
            expect(messageOf(response.json)).toBe(
                "Categories must belong to the mission's project",
            );
        });

        test('should return 400 if no file is given', async () => {
            const { user, missionUuid, categoryUuid } =
                await setupCategoryFixtures();

            const response = await send(user, 'POST', '/categories/add-many', {
                missionUUID: missionUuid,
                files: [],
                categories: [categoryUuid],
            });

            expect(response.status).toBe(400);
        });
    });

    test('should return 400 if the template name to check is missing', async () => {
        const { user } = await setupTestEnvironment();

        const missing = await send(user, 'GET', '/templates/availability');
        const given = await send(
            user,
            'GET',
            '/templates/availability?name=free-name',
        );

        expect(missing.status).toBe(400);
        expect(given.status).toBe(200);
    });

    test('should only sort API keys by their metadata', async () => {
        const { user } = await setupTestEnvironment();

        const bySecret = await send(
            user,
            'GET',
            '/users/me/api-keys?sortBy=apikey',
        );
        const byDate = await send(
            user,
            'GET',
            '/users/me/api-keys?sortBy=createdAt',
        );

        expect(bySecret.status).toBe(400);
        expect(byDate.status).toBe(200);
    });
});
