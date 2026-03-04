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

describe('Trigger Ownership API Tests', () => {
    setupDatabaseHooks();

    let userA: UserEntity;
    let userB: UserEntity;
    let missionUuid: string;
    let templateUuid: string;
    let projectUuid: string;

    beforeEach(async () => {
        // Create User A (Owner)
        const setupA = await generateAndFetchDatabaseUser('internal', 'admin');
        userA = setupA.user;

        // Create User B (Attacker)
        const setupB = await generateAndFetchDatabaseUser('external', 'user');
        userB = setupB.user;

        // Setup Project, Mission and Template as User A
        projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'desc',
                requiredTags: [],
                accessGroups: [],
            },
            userA,
        );

        missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            userA,
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
            userA,
        );
    });

    async function createTrigger(
        user: UserEntity,
        payload: Record<string, unknown>,
    ) {
        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify(payload),
        });

        expect(response.status).toBe(201);
        return (await response.json()) as { uuid: string };
    }

    test('User B should NOT be able to update User A trigger', async () => {
        // 1. User A creates a trigger
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        // 2. User B tries to update it
        const headersBuilder = new HeaderCreator(userB);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'PATCH',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify({ name: 'Updated by User B' }),
            },
        );

        expect(response.status).toBe(403);
    });

    test('User B should NOT be able to delete User A trigger', async () => {
        // 1. User A creates a trigger
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        // 2. User B tries to delete it
        const headersBuilder = new HeaderCreator(userB);

        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'DELETE',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(403);
    });

    test('User A should be able to update their own trigger', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const headersBuilder = new HeaderCreator(userA);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'PATCH',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify({ name: 'Updated by User A' }),
            },
        );

        expect(response.status).toBe(200);
    });

    test('User A should be able to delete their own trigger', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const headersBuilder = new HeaderCreator(userA);

        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'DELETE',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(200);
    });
});
