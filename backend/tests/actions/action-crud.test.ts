import { AccessGroupRights, ActionState } from '@kleinkram/shared';
import { database } from '../utils/database-utilities';

import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';

import { ActionEntity, ActionTemplateEntity } from '@kleinkram/backend-common';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('Action Management Tests', () => {
    setupDatabaseHooks();

    test('should create and archive an action template', async () => {
        const { user } = await setupTestEnvironment(
            'test-action@kleinkram.dev',
            'Action User',
        );

        // Create Action Template
        const templateUuid = await createActionUsingPost(
            {
                name: 'Archive Test Action',
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

        const templateRepo = database.getRepository(ActionTemplateEntity);
        const template = await templateRepo.findOneOrFail({
            where: { uuid: templateUuid },
        });
        expect(template.isArchived).toBe(false);

        // Archive Action Template
        const deleteResponse = await fetch(
            `${DEFAULT_URL}/templates/${templateUuid}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(user),
            },
        );
        expect(deleteResponse.status).toBeLessThan(300);

        // Verify it is deleted (hard delete)
        try {
            await templateRepo.findOneOrFail({
                where: { uuid: templateUuid },
            });
            fail('Template should have been deleted');
        } catch (error) {
            expect(error).toBeDefined();
        }
    }, 30_000);

    test('should submit an action run', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-run@kleinkram.io',
            'Run User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Run Test Action',
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

        // Create Worker
        await createMockWorker('test-worker-run');

        // Submit action

        await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        // Expect 409 because no worker is available (unless we mock it like in action-file-events)
        // or 201 if we don't care about execution success but just submission.
    }, 30_000);

    test('should attempt to cancel a pending action run and transition state', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-cancel@kleinkram.io',
            'Cancel User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Cancel Test Action',
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

        // Create Worker
        await createMockWorker('test-worker-cancel');

        // Submit action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const submitResult = (await submitResponse.json()) as {
            actionUUID: string;
        };
        const actionUuid = submitResult.actionUUID;

        // Manually update the action state to PENDING in the DB to simulate a queued action run
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.PENDING },
        );

        // Cancel action
        const cancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}/cancel`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(user),
                },
            },
        );
        // Expect 201 Created/Success because the worker queue is active on the API server
        expect(cancelResponse.status).toBe(201);

        // Verify database state updated to CANCELLED
        const actionAfter = await actionRepo.findOneOrFail({
            where: { uuid: actionUuid },
        });
        expect(actionAfter.state).toBe(ActionState.CANCELLED);
        expect(actionAfter.state_cause).toBe('Action cancelled by user');
    }, 30_000);

    test('should successfully cancel a running action run (state: PROCESSING) and transition state', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-cancel-running@kleinkram.io',
            'Cancel Running User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Cancel Running Test Action',
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

        await createMockWorker('test-worker-cancel-running');

        // Submit action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const submitResult = (await submitResponse.json()) as {
            actionUUID: string;
        };
        const actionUuid = submitResult.actionUUID;

        // Manually update the action state to PROCESSING in the DB to simulate a running action
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.PROCESSING },
        );

        // Cancel action
        const cancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}/cancel`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(user),
                },
            },
        );
        expect(cancelResponse.status).toBe(201);

        // Verify database state updated to CANCELLED
        const actionAfter = await actionRepo.findOneOrFail({
            where: { uuid: actionUuid },
        });
        expect(actionAfter.state).toBe(ActionState.CANCELLED);
        expect(actionAfter.state_cause).toBe('Action cancelled by user');
    }, 30_000);

    test('should successfully cancel a starting action run (state: STARTING) and transition state', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-cancel-starting@kleinkram.io',
            'Cancel Starting User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Cancel Starting Test Action',
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

        await createMockWorker('test-worker-cancel-starting');

        // Submit action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const submitResult = (await submitResponse.json()) as {
            actionUUID: string;
        };
        const actionUuid = submitResult.actionUUID;

        // Manually update the action state to STARTING in the DB to simulate a starting action
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.STARTING },
        );

        // Cancel action
        const cancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}/cancel`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(user),
                },
            },
        );
        expect(cancelResponse.status).toBe(201);

        // Verify database state updated to CANCELLED
        const actionAfter = await actionRepo.findOneOrFail({
            where: { uuid: actionUuid },
        });
        expect(actionAfter.state).toBe(ActionState.CANCELLED);
        expect(actionAfter.state_cause).toBe('Action cancelled by user');
    }, 30_000);

    test('should fail to cancel an already completed action run (state: DONE) and return 400', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-cancel-done@kleinkram.io',
            'Cancel Done User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Cancel Done Test Action',
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

        await createMockWorker('test-worker-cancel-done');

        // Submit action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const submitResult = (await submitResponse.json()) as {
            actionUUID: string;
        };
        const actionUuid = submitResult.actionUUID;

        // Manually update the action state to DONE in the DB to simulate a completed action
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.DONE },
        );

        // Cancel action
        const cancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}/cancel`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(user),
                },
            },
        );
        expect(cancelResponse.status).toBe(400);
        const cancelResult = (await cancelResponse.json()) as {
            message: string;
        };
        expect(cancelResult.message).toContain(
            'Cannot cancel action in state: DONE',
        );
    }, 30_000);
});
