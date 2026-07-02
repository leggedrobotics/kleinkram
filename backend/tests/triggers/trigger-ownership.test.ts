import { appVersion } from '@/app-version';
import { UserEntity } from '@kleinkram/backend-common';
import { ApiKeyEntity } from '@kleinkram/backend-common/entities/auth/api-key.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    KeyTypes,
    TriggerType,
} from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
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

    async function grantProjectReadAccess(
        user: UserEntity,
        projUuid: string,
    ): Promise<void> {
        const userWithGroups = await database
            .getRepository(UserEntity)
            .findOneOrFail({
                where: { uuid: user.uuid },
                relations: ['memberships', 'memberships.accessGroup'],
            });
        const primaryGroup = userWithGroups.memberships?.find(
            (m) => m.accessGroup?.type === AccessGroupType.PRIMARY,
        )?.accessGroup;
        if (!primaryGroup) {
            throw new Error('User has no primary access group');
        }

        const projectAccess = database
            .getRepository(ProjectAccessEntity)
            .create({
                project: { uuid: projUuid } as ProjectEntity,
                accessGroup: primaryGroup,
                rights: AccessGroupRights.READ,
            });
        await database.getRepository(ProjectAccessEntity).save(projectAccess);
    }

    async function createMissionApiKey(
        user: UserEntity,
        missionUUID: string,
        rights: AccessGroupRights,
    ): Promise<string> {
        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: missionUUID },
            rights,
            user,
        });
        await apiKeyRepo.save(apiKeyEntity);
        return apiKeyEntity.apikey;
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

    test('User B should NOT be able to read User A trigger', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(403);
    });

    test('Should return 404 for non-existent trigger', async () => {
        const headersBuilder = new HeaderCreator(userA);
        const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
        const response = await fetch(
            `${DEFAULT_URL}/triggers/${nonExistentUuid}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(404);
    });

    test('Non-creator with mission READ access can read trigger', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        await grantProjectReadAccess(userB, projectUuid);

        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string };
        expect(body.uuid).toBe(trigger.uuid);
    });

    test('findAll: non-admin without access sees no triggers from inaccessible missions', async () => {
        await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'GET',
            headers: headersBuilder.getHeaders(),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string }[];
        expect(body).toHaveLength(0);
    });

    test('findAll: non-admin with READ access sees triggers from accessible mission', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        await grantProjectReadAccess(userB, projectUuid);

        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'GET',
            headers: headersBuilder.getHeaders(),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string }[];
        expect(body).toHaveLength(1);
        expect(body[0].uuid).toBe(trigger.uuid);
    });

    test('findAll: non-admin with READ access and missionUuid filter sees only that mission triggers', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        await grantProjectReadAccess(userB, projectUuid);

        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(
            `${DEFAULT_URL}/triggers?missionUuid=${missionUuid}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string }[];
        expect(body).toHaveLength(1);
        expect(body[0].uuid).toBe(trigger.uuid);
    });

    test('findAll: non-admin without access gets 403 for inaccessible missionUuid', async () => {
        const headersBuilder = new HeaderCreator(userB);
        const response = await fetch(
            `${DEFAULT_URL}/triggers?missionUuid=${missionUuid}`,
            {
                method: 'GET',
                headers: headersBuilder.getHeaders(),
            },
        );

        expect(response.status).toBe(403);
    });

    test('findAll: admin sees all triggers', async () => {
        await createTrigger(userA, {
            name: 'Trigger 1',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });
        await createTrigger(userA, {
            name: 'Trigger 2',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const headersBuilder = new HeaderCreator(userA);
        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'GET',
            headers: headersBuilder.getHeaders(),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string }[];
        expect(body.length).toBeGreaterThanOrEqual(2);
    });

    test('API key with mission READ access can read trigger', async () => {
        const trigger = await createTrigger(userA, {
            name: 'User A Trigger',
            description: 'Owned by User A',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const apiKey = await createMissionApiKey(
            userB,
            missionUuid,
            AccessGroupRights.READ,
        );

        const response = await fetch(
            `${DEFAULT_URL}/triggers/${trigger.uuid}`,
            {
                method: 'GET',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'x-api-key': apiKey,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
            },
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string };
        expect(body.uuid).toBe(trigger.uuid);
    });

    test('findAll: API key is scoped to its mission and cannot list triggers from other missions', async () => {
        // userA (admin) creates a second mission and a trigger in each mission
        const missionUuid2 = await createMissionUsingPost(
            {
                name: 'test_mission_2',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            userA,
        );

        const triggerInScopedMission = await createTrigger(userA, {
            name: 'Scoped Mission Trigger',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });
        await createTrigger(userA, {
            name: 'Other Mission Trigger',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid2,
            templateUuid: templateUuid,
            config: {},
        });

        // userB gets an API key scoped to the first mission only
        const apiKey = await createMissionApiKey(
            userB,
            missionUuid,
            AccessGroupRights.READ,
        );

        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'GET',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'x-api-key': apiKey,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'kleinkram-client-version': appVersion,
            },
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as { uuid: string }[];
        // API key must only see triggers from its scoped mission, not mission2
        expect(body).toHaveLength(1);
        expect(body[0].uuid).toBe(triggerInScopedMission.uuid);
    });

    test('findAll: API key cannot escape its mission scope via missionUuid query param', async () => {
        // userA (admin) creates a second mission and a trigger in each mission
        const missionUuid2 = await createMissionUsingPost(
            {
                name: 'test_mission_2',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            userA,
        );

        const triggerInScopedMission = await createTrigger(userA, {
            name: 'Scoped Mission Trigger',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });
        await createTrigger(userA, {
            name: 'Other Mission Trigger',
            description: 'desc',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid2,
            templateUuid: templateUuid,
            config: {},
        });

        // userB gets an API key scoped to the first mission only
        const apiKey = await createMissionApiKey(
            userB,
            missionUuid,
            AccessGroupRights.READ,
        );

        // Adversarial attempt: pass the other mission's UUID as query param,
        // trying to escape the API key's mission scope.
        const response = await fetch(
            `${DEFAULT_URL}/triggers?missionUuid=${missionUuid2}`,
            {
                method: 'GET',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'x-api-key': apiKey,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
            },
        );

        // Either 403 (key has no access to mission2) or 200 with only the
        // scoped mission's triggers — both are acceptable security outcomes.
        // What must NOT happen: returning triggers from mission2.
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const body = (await response.json()) as { uuid: string }[];
            const otherMissionTrigger = body.find(
                (t) => t.uuid !== triggerInScopedMission.uuid,
            );
            expect(otherMissionTrigger).toBeUndefined();
        }
    });
});
