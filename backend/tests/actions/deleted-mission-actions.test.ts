import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights, ActionState, TriggerType } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const send = async (
    user: UserEntity | undefined,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; json: unknown }> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...(user ? getAuthHeaders(user) : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
        status: response.status,
        json: text === '' ? undefined : (JSON.parse(text) as unknown),
    };
};

const setup = async (): Promise<{
    user: UserEntity;
    missionUuid: string;
    templateUuid: string;
}> => {
    const { user, projectUuid } = await setupTestEnvironment();
    // actions are only accepted while a worker can run them
    await createMockWorker('deleted-mission-worker');
    const missionUuid = await createMissionUsingPost(
        {
            name: 'mission_to_delete',
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        user,
    );
    const templateUuid = await createActionUsingPost(
        {
            name: 'deleted-mission-template',
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
    return { user, missionUuid, templateUuid };
};

const submitAction = async (
    user: UserEntity,
    missionUuid: string,
    templateUuid: string,
): Promise<string> => {
    const response = await send(user, 'POST', '/actions', {
        missionUUID: missionUuid,
        templateUUID: templateUuid,
    });
    expect(response.status).toBeLessThan(300);
    return (response.json as { actionUUID: string }).actionUUID;
};

const createWebhook = async (
    user: UserEntity,
    missionUuid: string,
    templateUuid: string,
): Promise<string> => {
    const response = await send(user, 'POST', '/triggers', {
        name: 'mission-webhook',
        description: 'desc',
        missionUuid,
        templateUuid,
        type: TriggerType.WEBHOOK,
        config: {},
    });
    expect(response.status).toBe(201);
    return (response.json as { uuid: string }).uuid;
};

describe('Actions and Triggers of Deleted Missions', () => {
    setupDatabaseHooks();

    test('should return 409 if an action of the mission is still running', async () => {
        const { user, missionUuid, templateUuid } = await setup();
        const actionUuid = await submitAction(user, missionUuid, templateUuid);
        // nothing schedules actions in tests: mark it as running
        await database
            .getRepository(ActionEntity)
            .update({ uuid: actionUuid }, { state: ActionState.PROCESSING });

        const response = await send(user, 'DELETE', `/missions/${missionUuid}`);

        expect(response.status).toBe(409);
        expect((response.json as { message: string }).message).toBe(
            '1 action is still running. Cancel it or wait until it finishes.',
        );
    });

    test('should hide the actions of a deleted mission instead of failing', async () => {
        const { user, missionUuid, templateUuid } = await setup();
        const actionUuid = await submitAction(user, missionUuid, templateUuid);
        await database
            .getRepository(ActionEntity)
            .update({ uuid: actionUuid }, { state: ActionState.DONE });

        const deletion = await send(user, 'DELETE', `/missions/${missionUuid}`);
        expect(deletion.status).toBeLessThan(300);

        const list = await send(user, 'GET', '/actions?skip=0&take=50');
        expect(list.status).toBe(200);
        expect(
            (list.json as { data: { uuid: string }[] }).data.map(
                (action) => action.uuid,
            ),
        ).not.toContain(actionUuid);

        const detail = await send(user, 'GET', `/actions/${actionUuid}`);
        expect(detail.status).toBe(404);
    });

    test('should delete the triggers of a deleted mission', async () => {
        const { user, missionUuid, templateUuid } = await setup();
        const triggerUuid = await createWebhook(
            user,
            missionUuid,
            templateUuid,
        );

        await send(user, 'DELETE', `/missions/${missionUuid}`);

        const hook = await send(
            undefined,
            'POST',
            `/hooks/actions/${triggerUuid}`,
        );
        expect(hook.status).toBe(404);
        const list = await send(user, 'GET', '/triggers');
        expect(
            (list.json as { uuid: string }[]).map((trigger) => trigger.uuid),
        ).not.toContain(triggerUuid);
    });

    test('should return 404 for a webhook whose mission was deleted before its triggers were', async () => {
        const { user, missionUuid, templateUuid } = await setup();
        const triggerUuid = await createWebhook(
            user,
            missionUuid,
            templateUuid,
        );
        // a mission deleted before triggers were deleted with it
        await database
            .getRepository(MissionEntity)
            .softDelete({ uuid: missionUuid });

        const hook = await send(
            undefined,
            'GET',
            `/hooks/actions/${triggerUuid}`,
        );

        expect(hook.status).toBe(404);
    });
});
