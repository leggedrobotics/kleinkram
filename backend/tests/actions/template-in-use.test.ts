import { ActionTemplatesDto, CreateActionTriggerDto } from '@kleinkram/api-dto';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights, TriggerType } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const jsonHeaders = (user: UserEntity): Record<string, string> => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
    ...getAuthHeaders(user),
});

const createTemplate = (user: UserEntity, name: string): Promise<string> =>
    createActionUsingPost(
        {
            name,
            description: 'desc',
            accessRights: AccessGroupRights.READ,
            dockerImage: 'hello-world',
            maxRuntime: 10,
            cpuCores: 1,
            cpuMemory: 2,
            gpuMemory: 0,
        },
        user,
    );

const createWebhookTrigger = async (
    user: UserEntity,
    templateUuid: string,
    missionUuid: string,
): Promise<string> => {
    const dto: CreateActionTriggerDto = {
        name: 'nightly-webhook',
        description: 'runs the template',
        missionUuid,
        templateUuid,
        type: TriggerType.WEBHOOK,
        config: {},
    };
    const response = await fetch(`${DEFAULT_URL}/triggers`, {
        method: 'POST',
        headers: jsonHeaders(user),
        body: JSON.stringify(dto),
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { uuid: string }).uuid;
};

const deleteTemplate = (user: UserEntity, uuid: string): Promise<Response> =>
    fetch(`${DEFAULT_URL}/templates/${uuid}`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
    });

const findTemplate = async (
    user: UserEntity,
    name: string,
): Promise<ActionTemplatesDto['data'][number] | undefined> => {
    const response = await fetch(
        `${DEFAULT_URL}/templates?skip=0&take=100&includeArchived=true`,
        { headers: getAuthHeaders(user) },
    );
    const list = (await response.json()) as ActionTemplatesDto;
    return list.data.find((template) => template.name === name);
};

describe('Action Template In Use', () => {
    setupDatabaseHooks();

    test('should return 409 if a trigger still uses the template', async () => {
        const { user, missionUuid } = await setupTestEnvironment();
        const templateUuid = await createTemplate(user, 'used-by-trigger');
        await createWebhookTrigger(user, templateUuid, missionUuid);

        const response = await deleteTemplate(user, templateUuid);

        expect(response.status).toBe(409);
        const body = (await response.json()) as { message: string };
        expect(body.message).toBe(
            'Used by 1 trigger. Delete or change it first.',
        );
        const template = await findTemplate(user, 'used-by-trigger');
        expect(template?.archived).toBe(false);
        expect(template?.triggerCount).toBe(1);
    });

    test('should delete the template once its trigger is deleted', async () => {
        const { user, missionUuid } = await setupTestEnvironment();
        const templateUuid = await createTemplate(user, 'trigger-removed');
        const triggerUuid = await createWebhookTrigger(
            user,
            templateUuid,
            missionUuid,
        );
        await fetch(`${DEFAULT_URL}/triggers/${triggerUuid}`, {
            method: 'DELETE',
            headers: getAuthHeaders(user),
        });

        const response = await deleteTemplate(user, templateUuid);

        expect(response.status).toBe(204);
        expect(await findTemplate(user, 'trigger-removed')).toBeUndefined();
    });

    test('should delete the template and the dead trigger if only a trigger of a deleted mission uses it', async () => {
        const { user, projectUuid } = await setupTestEnvironment();
        const missionUuid = await createMissionUsingPost(
            {
                name: 'short_lived_mission',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
        const templateUuid = await createTemplate(user, 'orphan-trigger');
        await createWebhookTrigger(user, templateUuid, missionUuid);
        const missionDeletion = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}`,
            { method: 'DELETE', headers: getAuthHeaders(user) },
        );
        expect(missionDeletion.status).toBeLessThan(300);

        const response = await deleteTemplate(user, templateUuid);

        expect(response.status).toBe(204);
        // the dialog promised a deletion (no executions): it must not be
        // archived because of a trigger that can never fire
        expect(await findTemplate(user, 'orphan-trigger')).toBeUndefined();
    });
});
