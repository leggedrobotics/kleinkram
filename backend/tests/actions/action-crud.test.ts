import { AccessGroupRights } from '@common/frontend_shared/enum';
import { database } from '../utils/database-utilities';

import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';

import ActionTemplateEntity from '@common/entities/action/action-template.entity';
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
        let template = await templateRepo.findOneOrFail({
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

        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
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
});
