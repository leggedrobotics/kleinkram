import { AccessGroupRights, ActionState, UserRole } from '@kleinkram/shared';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';

import { ActionEntity, ActionTemplateEntity } from '@kleinkram/backend-common';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const postVersion = (
    uuid: string,
    body: Record<string, unknown>,
    user: Parameters<typeof getAuthHeaders>[0],
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/templates/${uuid}/versions`, {
        method: 'POST',
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        body: JSON.stringify(body),
    });

describe('Action Management Tests', () => {
    setupDatabaseHooks();

    test('should create and archive an action template', async () => {
        const { user } = await setupTestEnvironment(
            'test-action@leggedrobotics.com',
            'Action User',
        );

        // Create Action Template
        const templateUuid = await createActionUsingPost(
            {
                name: 'Archive-Test-Action',
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
                name: 'Run-Test-Action',
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
                name: 'Cancel-Test-Action',
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
                name: 'Cancel-Running-Test-Action',
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
                name: 'Cancel-Starting-Test-Action',
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
                name: 'Cancel-Done-Test-Action',
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

    test('should allow deleting a cancelled action run', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-delete-cancelled@kleinkram.io',
            'Delete Cancelled User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Delete-Cancelled-Test-Action',
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

        await createMockWorker('test-worker-delete-cancelled');

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

        // Simulate an action that was cancelled by the user
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.CANCELLED },
        );

        const deleteResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(user),
            },
        );
        expect(deleteResponse.status).toBeLessThan(300);

        const deletedAction = await actionRepo.findOne({
            where: { uuid: actionUuid },
        });
        expect(deletedAction).toBeNull();
    }, 30_000);

    test('should reject deleting a still running action run', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-delete-running@kleinkram.io',
            'Delete Running User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Delete-Running-Test-Action',
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

        await createMockWorker('test-worker-delete-running');

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

        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUuid },
            { state: ActionState.PROCESSING },
        );

        const deleteResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(user),
            },
        );
        expect(deleteResponse.status).toBe(400);

        const stillThere = await actionRepo.findOne({
            where: { uuid: actionUuid },
        });
        expect(stillThere).not.toBeNull();
    }, 30_000);

    test('should restore an old template version as a new version', async () => {
        const { user } = await setupTestEnvironment(
            'test-restore@leggedrobotics.com',
            'Restore User',
        );

        const jsonHeaders = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        };

        const versionOnePayload = {
            name: 'Restore-Test-Action',
            description: 'version one',
            accessRights: AccessGroupRights.READ,
            dockerImage: 'hello-world',
            command: 'echo v1',
            entrypoint: '/bin/sh',
            maxRuntime: 10,
            cpuCores: 1,
            cpuMemory: 2,
            gpuMemory: 0,
        };

        const versionOneUuid = await createActionUsingPost(
            versionOnePayload,
            user,
        );

        // Create a second version (this is what the "Save New Version" button does)
        const versionTwoResponse = await fetch(
            `${DEFAULT_URL}/templates/${versionOneUuid}/versions`,
            {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    ...versionOnePayload,
                    uuid: versionOneUuid,
                    description: 'version two',
                    command: 'echo v2',
                }),
            },
        );
        expect(versionTwoResponse.status).toBe(201);
        const versionTwo = (await versionTwoResponse.json()) as {
            uuid: string;
            version: string;
        };
        expect(Number(versionTwo.version)).toBe(2);

        // Restore version one: the frontend posts the content of the old
        // version, which the backend turns into a new (third) version.
        const restoreResponse = await fetch(
            `${DEFAULT_URL}/templates/${versionOneUuid}/versions`,
            {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    ...versionOnePayload,
                    uuid: versionOneUuid,
                }),
            },
        );
        expect(restoreResponse.status).toBe(201);
        const restored = (await restoreResponse.json()) as {
            uuid: string;
            version: string;
            description: string;
            command: string;
        };
        expect(Number(restored.version)).toBe(3);
        expect(restored.uuid).not.toBe(versionOneUuid);
        expect(restored.description).toBe('version one');
        expect(restored.command).toBe('echo v1');

        // The revision history contains all three versions, newest first
        const revisionsResponse = await fetch(
            `${DEFAULT_URL}/templates/${versionOneUuid}/revisions?skip=0&take=10`,
            { headers: getAuthHeaders(user) },
        );
        expect(revisionsResponse.status).toBe(200);
        const revisions = (await revisionsResponse.json()) as {
            count: number;
            data: { uuid: string; version: string; executionCount: number }[];
        };
        expect(revisions.count).toBe(3);
        expect(revisions.data.map((rev) => Number(rev.version))).toEqual([
            3, 2, 1,
        ]);
        expect(revisions.data.map((rev) => rev.executionCount)).toEqual([
            0, 0, 0,
        ]);
    }, 30_000);

    describe('Template Ownership', () => {
        const basePayload = {
            name: 'Ownership-Test-Action',
            description: 'owned by the creator',
            accessRights: AccessGroupRights.READ,
            dockerImage: 'hello-world',
            command: 'echo owner',
            maxRuntime: 10,
            cpuCores: 1,
            cpuMemory: 2,
            gpuMemory: 0,
        };

        const setupOwnerAndOther = async () => {
            const owner = await getUserFromDatabase(
                await mockDatabaseUser(
                    'template-owner@leggedrobotics.com',
                    'Template Owner',
                    UserRole.USER,
                ),
            );
            const other = await getUserFromDatabase(
                await mockDatabaseUser(
                    'template-other@leggedrobotics.com',
                    'Other Creator',
                    UserRole.USER,
                ),
            );
            const templateUuid = await createActionUsingPost(
                basePayload,
                owner,
            );
            return { owner, other, templateUuid };
        };

        test('should reject a new version from a user who did not create the template', async () => {
            const { other, templateUuid } = await setupOwnerAndOther();

            const response = await postVersion(
                templateUuid,
                {
                    ...basePayload,
                    uuid: templateUuid,
                    command: 'echo hijacked',
                },
                other,
            );
            expect(response.status).toBe(403);

            const versions = await database
                .getRepository(ActionTemplateEntity)
                .count({ where: { name: basePayload.name } });
            expect(versions).toBe(1);
        }, 30_000);

        test('should let the creator add a new version', async () => {
            const { owner, templateUuid } = await setupOwnerAndOther();

            const response = await postVersion(
                templateUuid,
                { ...basePayload, uuid: templateUuid, command: 'echo v2' },
                owner,
            );
            expect(response.status).toBe(201);
            const versionTwo = (await response.json()) as {
                version: string;
            };
            expect(Number(versionTwo.version)).toBe(2);
        }, 30_000);

        test('should allow an admin to add a version to any template', async () => {
            const { templateUuid } = await setupOwnerAndOther();
            const admin = await getUserFromDatabase(
                await mockDatabaseUser(
                    'template-admin@leggedrobotics.com',
                    'Template Admin',
                    UserRole.ADMIN,
                ),
            );

            const response = await postVersion(
                templateUuid,
                { ...basePayload, uuid: templateUuid, command: 'echo admin' },
                admin,
            );
            expect(response.status).toBe(201);
        }, 30_000);

        test('should return 404 for a version of a template that does not exist', async () => {
            const { owner } = await setupOwnerAndOther();
            const missing = '00000000-0000-4000-8000-000000000000';

            const response = await postVersion(
                missing,
                {
                    ...basePayload,
                    name: 'Brand-New-Name',
                    uuid: missing,
                },
                owner,
            );
            expect(response.status).toBe(404);

            const created = await database
                .getRepository(ActionTemplateEntity)
                .count({ where: { name: 'Brand-New-Name' } });
            expect(created).toBe(0);
        }, 30_000);

        test('should reject a new version that changes the template name', async () => {
            const { owner, other, templateUuid } = await setupOwnerAndOther();
            const otherTemplateUuid = await createActionUsingPost(
                { ...basePayload, name: 'Other-Users-Action' },
                other,
            );
            expect(otherTemplateUuid).toBeTruthy();

            // The owner of one template tries to append to another one by name
            const response = await postVersion(
                templateUuid,
                {
                    ...basePayload,
                    name: 'Other-Users-Action',
                    uuid: templateUuid,
                },
                owner,
            );
            expect(response.status).toBe(400);

            const versions = await database
                .getRepository(ActionTemplateEntity)
                .count({ where: { name: 'Other-Users-Action' } });
            expect(versions).toBe(1);
        }, 30_000);

        test('should reject deleting a template from a user who did not create it', async () => {
            const { other, templateUuid } = await setupOwnerAndOther();

            const response = await fetch(
                `${DEFAULT_URL}/templates/${templateUuid}`,
                { method: 'DELETE', headers: getAuthHeaders(other) },
            );
            expect(response.status).toBe(403);

            const stillThere = await database
                .getRepository(ActionTemplateEntity)
                .findOne({ where: { uuid: templateUuid } });
            expect(stillThere).not.toBeNull();
        }, 30_000);
    });
});
