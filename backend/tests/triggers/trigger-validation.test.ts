import { UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, TriggerType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { setupDatabaseHooks } from '../utils/test-helpers';

describe('Trigger Validation Tests', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let missionUuid: string;
    let templateUuid: string;
    let projectUuid: string;

    beforeEach(async () => {
        const setup = await generateAndFetchDatabaseUser('internal', 'admin');
        user = setup.user;

        projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'desc',
                requiredTags: [],
                accessGroups: [],
            },
            user,
        );

        missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        templateUuid = await createActionUsingPost(
            {
                name: 'Test Action',
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
    });

    async function createTrigger(payload: Record<string, unknown>) {
        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        return await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify(payload),
        });
    }

    test('should allow creating TIME trigger with valid cron', async () => {
        const response = await createTrigger({
            name: 'Valid Time Trigger',
            description: 'Valid time trigger description',
            type: TriggerType.TIME,
            missionUuid,
            templateUuid,
            config: { cron: '0 0 * * *' },
        });
        expect(response.status).toBe(201);
    });

    test('should fail creating TIME trigger with invalid cron', async () => {
        const response = await createTrigger({
            name: 'Invalid Time Trigger',
            description: 'Invalid time trigger description',
            type: TriggerType.TIME,
            missionUuid,
            templateUuid,
            config: { cron: 'invalid' },
        });
        expect(response.status).toBe(400);
        const data = (await response.json()) as { message: string };
        expect(data.message).toBe('Invalid cron expression');
    });

    test('should allow creating FILE trigger with valid patterns', async () => {
        const response = await createTrigger({
            name: 'Valid File Trigger',
            description: 'Valid file trigger description',
            type: TriggerType.FILE,
            missionUuid,
            templateUuid,
            config: { patterns: ['*.bag', 'test.yml'] },
        });
        expect(response.status).toBe(201);
    });

    test('should fail creating FILE trigger with empty patterns', async () => {
        const response = await createTrigger({
            name: 'Empty Patterns File Trigger',
            description: 'Empty patterns description',
            type: TriggerType.FILE,
            missionUuid,
            templateUuid,
            config: { patterns: [] },
        });
        expect(response.status).toBe(400);
        const data = (await response.json()) as { message: string | string[] };
        const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message;
        expect(message).toContain('"patterns" must be a non-empty array');
    });

    test('should fail creating FILE trigger with invalid pattern types', async () => {
        const response = await createTrigger({
            name: 'Invalid Pattern Type File Trigger',
            description: 'Invalid pattern type description',
            type: TriggerType.FILE,
            missionUuid,
            templateUuid,
            config: { patterns: [123] },
        });
        expect(response.status).toBe(400);
        const data = (await response.json()) as { message: string | string[] };
        const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message;
        expect(message).toContain(
            'all "patterns" entries must be non-empty strings',
        );
    });

    test('should fail creating FILE trigger with empty pattern strings', async () => {
        const response = await createTrigger({
            name: 'Empty Pattern String File Trigger',
            description: 'Empty pattern string description',
            type: TriggerType.FILE,
            missionUuid,
            templateUuid,
            config: { patterns: [''] },
        });
        expect(response.status).toBe(400);
        const data = (await response.json()) as { message: string | string[] };
        const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message;
        expect(message).toContain(
            'all "patterns" entries must be non-empty strings',
        );
    });
});
