import { appVersion } from '@/app-version';
import { UserEntity, WorkerEntity } from '@kleinkram/backend-common';
import { systemUser } from '@kleinkram/backend-common/consts';
import { AccessGroupRights, TriggerType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

describe('Webhook Validation Tests', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let missionUuid: string;
    let templateUuid: string;
    let projectUuid: string;

    beforeEach(async () => {
        // Seed a stable worker for the dispatcher
        const workerRepo = database.getRepository(WorkerEntity);
        const identifier = 'test-worker-webhook-validation';
        const workerData = {
            identifier,
            hostname: 'test-host',
            reachable: true,
            lastSeen: new Date(),
            cpuCores: 8,
            cpuMemory: 16,
            gpuMemory: 0,
            cpuModel: 'Test CPU',
            storage: 1000,
        };
        await workerRepo.save(workerRepo.create(workerData));

        const setup = await generateAndFetchDatabaseUser('internal', 'admin');
        user = setup.user;

        // Seed the systemUser for webhook triggers
        const userRepo = database.getRepository(UserEntity);
        const existingSystemUser = await userRepo.findOneBy({
            uuid: systemUser.uuid,
        });
        if (!existingSystemUser) {
            await userRepo.save(
                userRepo.create({
                    uuid: systemUser.uuid,
                    name: systemUser.name,
                    email: systemUser.email,
                    role: systemUser.role,
                    avatarUrl: systemUser.avatarUrl,
                }),
            );
        }

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

        const headers = headersBuilder.getHeaders();

        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        expect(response.status).toBe(201);
        return (await response.json()) as { uuid: string };
    }

    test('should trigger action via webhook with valid payload', async () => {
        const trigger = await createTrigger({
            name: 'Webhook Trigger',
            description: 'Triggers via webhook',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const hookResponse = await fetch(
            `${DEFAULT_URL}/hooks/actions/${trigger.uuid}`,
            {
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
                body: JSON.stringify({ key: 'value' }),
            },
        );

        expect(hookResponse.status).toBe(201);
    });

    test('should fail when payload is an array', async () => {
        const trigger = await createTrigger({
            name: 'Webhook Trigger',
            description: 'Triggers via webhook',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        const hookResponse = await fetch(
            `${DEFAULT_URL}/hooks/actions/${trigger.uuid}`,
            {
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
                body: JSON.stringify(['not', 'an', 'object']),
            },
        );

        expect(hookResponse.status).toBe(400);
        const data = (await hookResponse.json()) as { message: string };
        expect(data.message).toContain('Payload must be a plain object');
    });

    test('should fail when payload is too large', async () => {
        const trigger = await createTrigger({
            name: 'Webhook Trigger',
            description: 'Triggers via webhook',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        // Create a payload larger than 100KB
        const largeValue = 'a'.repeat(101 * 1024);
        const payload = { data: largeValue };

        const hookResponse = await fetch(
            `${DEFAULT_URL}/hooks/actions/${trigger.uuid}`,
            {
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
                body: JSON.stringify(payload),
            },
        );

        expect(hookResponse.status).toBe(413); // Payload Too Large
        const data = (await hookResponse.json()) as { message: string };
        expect(data.message).toContain('Payload too large');
    });
});
