import {
    ActionTriggerDto,
    CreateActionTriggerDto,
    UpdateActionTriggerDto,
} from '@kleinkram/api-dto';
import {
    AccessGroupRights,
    TriggerEvent,
    TriggerType,
    UserRole,
} from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';
import {
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('Action Triggers CRUD Tests', () => {
    setupDatabaseHooks();

    test('should create, retrieve, update, and delete an action trigger', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'trigger-user@kleinkram.dev',
            'Trigger User',
        );

        // Create Action Template
        const templateUuid = await createActionUsingPost(
            {
                name: 'Trigger Test Action',
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

        // 1. Create a trigger
        const createDto: CreateActionTriggerDto = {
            name: 'Test File Trigger',
            description: 'Triggers on file upload',
            missionUuid,
            templateUuid,
            type: TriggerType.FILE,
            config: {
                patterns: ['*.txt'],
                event: [TriggerEvent.UPLOAD],
            },
        };

        const createResponse = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify(createDto),
        });

        expect(createResponse.status).toBe(201);
        const createdTrigger: ActionTriggerDto =
            (await createResponse.json()) as ActionTriggerDto;
        expect(createdTrigger.name).toBe(createDto.name);
        expect(createdTrigger.type).toBe(createDto.type);
        expect(createdTrigger.uuid).toBeDefined();

        const triggerUuid = createdTrigger.uuid;

        // 2. Get triggers by mission
        const getResponse = await fetch(
            `${DEFAULT_URL}/triggers?missionUuid=${missionUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );

        expect(getResponse.status).toBe(200);
        const triggers: ActionTriggerDto[] =
            (await getResponse.json()) as ActionTriggerDto[];
        expect(Array.isArray(triggers)).toBe(true);
        expect(triggers.length).toBeGreaterThanOrEqual(1);
        expect(triggers.find((t) => t.uuid === triggerUuid)).toBeDefined();

        // 3. Update trigger
        const updateDto: UpdateActionTriggerDto = {
            name: 'Updated File Trigger',
            config: {
                patterns: ['*.png', '*.jpg'],
                event: [TriggerEvent.UPLOAD, TriggerEvent.RENAME],
            },
        };

        const updateResponse = await fetch(
            `${DEFAULT_URL}/triggers/${triggerUuid}`,
            {
                method: 'PATCH',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(user),
                },
                body: JSON.stringify(updateDto),
            },
        );

        expect(updateResponse.status).toBe(200);
        const updatedTrigger: ActionTriggerDto =
            (await updateResponse.json()) as ActionTriggerDto;
        expect(updatedTrigger.name).toBe(updateDto.name);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        expect((updatedTrigger.config as any).patterns).toContain('*.png');

        // 4. Delete trigger
        const deleteResponse = await fetch(
            `${DEFAULT_URL}/triggers/${triggerUuid}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(user),
            },
        );

        expect(deleteResponse.status).toBe(200);

        // Verify deletion
        const getAgainResponse = await fetch(
            `${DEFAULT_URL}/triggers?missionUuid=${missionUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );

        expect(getAgainResponse.status).toBe(200);
        const triggersAfterDelete: ActionTriggerDto[] =
            (await getAgainResponse.json()) as ActionTriggerDto[];
        expect(
            triggersAfterDelete.find((t) => t.uuid === triggerUuid),
        ).toBeUndefined();
    }, 30_000);

    test('should deny access to unauthorized users for triggers', async () => {
        const creatorEnvironment = await setupTestEnvironment(
            'trigger-creator@kleinkram.dev',
            'Trigger Creator',
        );

        // A user that is not part of the project
        const unauthorizedUserId = await mockDatabaseUser(
            'unauthorized-user@other-domain.com',
            'Unauthorized User',
            UserRole.USER,
        );
        const unauthorizedUser = await getUserFromDatabase(unauthorizedUserId);

        // Create an action template
        const templateUuid = await createActionUsingPost(
            {
                name: 'Another Trigger Action',
                description: 'desc',
                accessRights: AccessGroupRights.READ,
                dockerImage: 'hello-world',
                maxRuntime: 10,
                cpuCores: 1,
                cpuMemory: 2,
                gpuMemory: 0,
            },
            creatorEnvironment.user,
        );

        const createDto: CreateActionTriggerDto = {
            name: 'Another Test Trigger',
            description: 'desc',
            missionUuid: creatorEnvironment.missionUuid,
            templateUuid,
            type: TriggerType.TIME,
            config: {
                cron: '0 0 * * *',
            },
        };

        // Unauthorized user attempts to create trigger in creator's mission
        const createResponse = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(unauthorizedUser),
            },
            body: JSON.stringify(createDto),
        });

        // The user doesn't have create/write rights in the mission
        expect(createResponse.status).toBe(403);
    });
});
