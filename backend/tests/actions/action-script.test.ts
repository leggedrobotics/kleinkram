import {
    ActionEntity,
    ActionTemplateEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupRights,
    MAX_ACTION_SCRIPT_BYTES,
    SCRIPT_RUNNER_TEMPLATE_NAME,
    SCRIPT_RUNNER_TEMPLATE_UUID,
} from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { getAuthHeaders } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const SCRIPT = 'print("hello from a script action")\n';

/**
 * The row SeedScriptRunnerTemplate1790081400000 writes. The test database is
 * truncated between tests, so every test that needs it puts it back.
 */
const seedScriptRunner = async (
    creator: UserEntity,
    overrides: Partial<ActionTemplateEntity> = {},
): Promise<ActionTemplateEntity> => {
    const repository = database.getRepository(ActionTemplateEntity);
    return repository.save(
        repository.create({
            uuid: SCRIPT_RUNNER_TEMPLATE_UUID,
            name: SCRIPT_RUNNER_TEMPLATE_NAME,
            description: 'Runs a single Python file.',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: 'rslethz/action:script-runner-latest',
            version: 1,
            creator,
            cpuCores: 2,
            cpuMemory: 4,
            gpuMemory: -1,
            maxRuntime: 0.25,
            accessRights: AccessGroupRights.WRITE,
            isArchived: false,
            isSystem: true,
            ...overrides,
        }),
    );
};

const submitScript = (
    user: UserEntity,
    body: Record<string, unknown>,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/actions/script`, {
        method: 'POST',
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        body: JSON.stringify(body),
    });

describe('Script actions', () => {
    setupDatabaseHooks();

    test('stores the script, dispatches it on the runner and reads it back', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'script-submit@kleinkram.dev',
            'Script User',
        );
        await seedScriptRunner(user);
        await createMockWorker('script-worker');

        const response = await submitScript(user, {
            missionUUID: missionUuid,
            script: SCRIPT,
            filename: 'analyse.py',
            maxRuntimeHours: 0.1,
        });
        expect(response.status).toBe(201);
        const { actionUUID } = (await response.json()) as {
            actionUUID: string;
        };

        const action = await database
            .getRepository(ActionEntity)
            .findOneOrFail({
                where: { uuid: actionUUID },
                relations: { template: true },
            });
        expect(action.template?.uuid).toBe(SCRIPT_RUNNER_TEMPLATE_UUID);
        expect(action.scriptObject).toMatch(
            new RegExp(String.raw`^${missionUuid}/[0-9a-f-]+\.py$`),
        );
        expect(action.maxRuntimeHours).toBeCloseTo(0.1);

        const details = await fetch(`${DEFAULT_URL}/actions/${actionUUID}`, {
            headers: getAuthHeaders(user),
        });
        expect(details.status).toBe(200);
        expect(
            ((await details.json()) as { hasScript: boolean }).hasScript,
        ).toBe(true);

        const script = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/script`,
            { headers: getAuthHeaders(user) },
        );
        expect(script.status).toBe(200);
        expect(await script.json()).toEqual({
            filename: 'analyse.py',
            content: SCRIPT,
        });
    }, 30_000);

    test('rejects a runtime above the template budget', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'script-runtime@kleinkram.dev',
            'Script User',
        );
        await seedScriptRunner(user);
        await createMockWorker('script-worker-runtime');

        const response = await submitScript(user, {
            missionUUID: missionUuid,
            script: SCRIPT,
            filename: 'analyse.py',
            maxRuntimeHours: 1,
        });
        expect(response.status).toBe(400);
        expect(await database.getRepository(ActionEntity).count()).toBe(0);
    }, 30_000);

    test('rejects oversized scripts and unusable filenames', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'script-invalid@kleinkram.dev',
            'Script User',
        );
        await seedScriptRunner(user);

        // Multi-byte characters: under the DTO's UTF-16 bound, over the byte
        // limit the service enforces.
        const oversized = await submitScript(user, {
            missionUUID: missionUuid,
            script: 'é'.repeat(MAX_ACTION_SCRIPT_BYTES / 2 + 1),
            filename: 'analyse.py',
        });
        expect(oversized.status).toBe(400);

        for (const filename of [
            '../escape.py',
            'analyse.sh',
            'dir/analyse.py',
        ]) {
            const response = await submitScript(user, {
                missionUUID: missionUuid,
                script: SCRIPT,
                filename,
            });
            expect(response.status).toBe(400);
        }
    }, 30_000);

    test('ignores a same-named template that is not system-managed', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'script-impostor@kleinkram.dev',
            'Script User',
        );
        await seedScriptRunner(user, {
            uuid: undefined,
            isSystem: false,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: 'someone/else:latest',
        });

        const response = await submitScript(user, {
            missionUUID: missionUuid,
            script: SCRIPT,
            filename: 'analyse.py',
        });
        expect(response.status).toBe(403);
    }, 30_000);

    test('the runner template cannot be versioned or deleted', async () => {
        const { user } = await setupTestEnvironment(
            'script-immutable@kleinkram.dev',
            'Script Admin',
        );
        const template = await seedScriptRunner(user);

        const version = await fetch(
            `${DEFAULT_URL}/templates/${template.uuid}/versions`,
            {
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(user),
                },
                body: JSON.stringify({
                    uuid: template.uuid,
                    name: SCRIPT_RUNNER_TEMPLATE_NAME,
                    description: 'hijacked',
                    dockerImage: 'rslethz/action:hijacked',
                    cpuCores: 1,
                    cpuMemory: 1,
                    gpuMemory: -1,
                    maxRuntime: 1,
                    accessRights: AccessGroupRights.READ,
                }),
            },
        );
        expect(version.status).toBe(403);

        const deletion = await fetch(
            `${DEFAULT_URL}/templates/${template.uuid}`,
            { method: 'DELETE', headers: getAuthHeaders(user) },
        );
        expect(deletion.status).toBe(403);

        const stored = await database
            .getRepository(ActionTemplateEntity)
            .find({ where: { name: SCRIPT_RUNNER_TEMPLATE_NAME } });
        expect(stored).toHaveLength(1);
        expect(stored[0]?.image_name).toBe(
            'rslethz/action:script-runner-latest',
        );
    }, 30_000);
});
