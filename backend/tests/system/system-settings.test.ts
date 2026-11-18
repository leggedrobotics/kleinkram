import { UserEntity } from '@kleinkram/backend-common';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import { createProjectUsingPost, getAuthHeaders } from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';

interface Settings {
    foxglovePreviewEnabled: boolean;
}

const getSettings = async (user: UserEntity): Promise<Response> =>
    fetch(`${DEFAULT_URL}/system/settings`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });

const putSettings = async (
    user: UserEntity,
    body: unknown,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/system/settings`, {
        method: 'PUT',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

describe('System Settings', () => {
    setupDatabaseHooks();

    test('should enable the Foxglove preview by default', async () => {
        const { user } = await generateAndFetchDatabaseUser('external', 'user');

        const response = await getSettings(user);

        expect(response.status).toBe(200);
        expect((await response.json()) as Settings).toEqual({
            foxglovePreviewEnabled: true,
        });
    });

    test('should return 401 Unauthorized without a login', async () => {
        const response = await fetch(`${DEFAULT_URL}/system/settings`, {
            headers: getAuthHeaders(),
        });

        expect(response.status).toBe(401);
    });

    test('should let an admin turn the Foxglove preview off for everyone', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user } = await generateAndFetchDatabaseUser('external', 'user');

        const response = await putSettings(admin, {
            foxglovePreviewEnabled: false,
        });

        expect(response.status).toBe(200);
        expect((await response.json()) as Settings).toEqual({
            foxglovePreviewEnabled: false,
        });
        const seenByUser = await getSettings(user);
        expect((await seenByUser.json()) as Settings).toEqual({
            foxglovePreviewEnabled: false,
        });
    });

    test.each([
        ['an internal user', 'internal'],
        ['an external user', 'external'],
    ] as const)(
        'should return 403 Forbidden if %s changes the settings',
        async (_, kind) => {
            const { user } = await generateAndFetchDatabaseUser(kind, 'user');

            const response = await putSettings(user, {
                foxglovePreviewEnabled: false,
            });

            expect(response.status).toBe(403);
            const after = await getSettings(user);
            expect((await after.json()) as Settings).toEqual({
                foxglovePreviewEnabled: true,
            });
        },
    );

    test('should return 400 Bad Request for a value that is not a boolean', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const response = await putSettings(admin, {
            foxglovePreviewEnabled: 'false',
        });

        expect(response.status).toBe(400);
        const after = await getSettings(admin);
        expect((await after.json()) as Settings).toEqual({
            foxglovePreviewEnabled: true,
        });
    });
});

const getProject = async (
    user: UserEntity,
    projectUuid: string,
): Promise<{ foxglovePreviewEnabled: boolean }> => {
    const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { foxglovePreviewEnabled: boolean };
};

const isPreviewEnabled = async (
    user: UserEntity,
    projectUuid: string,
): Promise<boolean> => {
    const project = await getProject(user, projectUuid);
    return project.foxglovePreviewEnabled;
};

describe('Project Foxglove Preview Setting', () => {
    setupDatabaseHooks();

    test('should enable the preview for a new project and let its editors turn it off', async () => {
        const { user } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const projectUuid = await createProjectUsingPost(
            {
                name: `foxglove_preview_${String(Date.now())}`,
                description: 'Test project',
            },
            user,
        );
        expect(await isPreviewEnabled(user, projectUuid)).toBe(true);

        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(user),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `foxglove_preview_${String(Date.now())}`,
                description: 'Test project',
                foxglovePreviewEnabled: false,
            }),
        });

        expect(response.status).toBe(200);
        expect(await isPreviewEnabled(user, projectUuid)).toBe(false);
    });

    test('should keep the preview setting when an update leaves it out', async () => {
        const { user } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const name = `foxglove_preview_${String(Date.now())}`;
        const projectUuid = await createProjectUsingPost(
            {
                name,
                description: 'Test project',
                foxglovePreviewEnabled: false,
            },
            user,
        );

        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(user),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description: 'Changed' }),
        });

        expect(response.status).toBe(200);
        expect(await isPreviewEnabled(user, projectUuid)).toBe(false);
    });
});
