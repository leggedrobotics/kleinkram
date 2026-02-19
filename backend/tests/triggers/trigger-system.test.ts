import { appVersion } from '@/app-version';
import { ActionTriggerDto } from '@kleinkram/api-dto';
import {
    ActionEntity,
    ActionTriggerEntity,
    FileEntity,
    MissionEntity,
    UserEntity,
    WorkerEntity,
} from '@kleinkram/backend-common';
import { systemUser } from '@kleinkram/backend-common/consts';
import {
    AccessGroupRights,
    ActionState,
    FileState,
    FileType,
    TriggerEvent,
    TriggerType,
} from '@kleinkram/shared';
import { minimatch } from 'minimatch';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

describe('Trigger System API Tests', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let missionUuid: string;
    let templateUuid: string;
    let projectUuid: string;

    beforeAll(async () => {
        // Seed a stable worker for the dispatcher
        const workerRepo = database.getRepository(WorkerEntity);
        const identifier = 'test-worker-trigger-system';
        const existing = await workerRepo.findOneBy({ identifier });

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

        if (existing) {
            Object.assign(existing, workerData);
            await workerRepo.save(existing);
        } else {
            await workerRepo.save(workerRepo.create(workerData));
        }
    });

    beforeEach(async () => {
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

        const response = await fetch(`${DEFAULT_URL}/triggers`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify(payload),
        });

        expect(response.status).toBe(201);
        return (await response.json()) as { uuid: string };
    }

    async function createMockFile(filename: string): Promise<FileEntity> {
        const fileRepo = database.getRepository(FileEntity);
        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneByOrFail({
            uuid: missionUuid,
        });

        return await fileRepo.save(
            fileRepo.create({
                filename,
                mission,
                creator: user,
                type: filename.endsWith('.bag') ? FileType.BAG : FileType.YAML,
                size: 123,
                date: new Date(),
                state: FileState.OK,
            }),
        );
    }

    /**
     * Simulates the work of TriggerQueueProcessorProvider.handleFileEvent
     * because the queue consumer might not be running during API tests.
     */
    async function simulateFileEventJob(fileUuid: string, event: TriggerEvent) {
        const triggerRepo = database.getRepository(ActionTriggerEntity);
        const fileRepo = database.getRepository(FileEntity);

        const file = await fileRepo.findOne({
            where: { uuid: fileUuid },
            relations: ['mission'],
        });
        if (!file?.mission) return;

        const triggers = await triggerRepo.find({
            where: {
                mission: { uuid: file.mission.uuid },
                type: TriggerType.FILE,
            },
            relations: ['template', 'mission'],
        });

        for (const trigger of triggers) {
            const config = trigger.config as {
                patterns?: string[];
                event?: TriggerEvent[];
            };
            if (config.event && !config.event.includes(event)) continue;

            const patterns = config.patterns ?? [];
            const matches = patterns.some((p: string) =>
                minimatch(file.filename, p, { dot: true, matchBase: true }),
            );

            if (patterns.length > 0 && !matches) continue;

            const actionRepo = database.getRepository(ActionEntity);

            await actionRepo.save(
                actionRepo.create({
                    state: ActionState.PENDING,
                    template: trigger.template,
                    mission: trigger.mission,
                    creator: user,
                }),
            );
        }
    }

    test('should trigger action via webhook', async () => {
        // 1. Create Webhook Trigger
        const trigger = await createTrigger({
            name: 'Webhook Trigger',
            description: 'Triggers via webhook',
            type: TriggerType.WEBHOOK,
            missionUuid: missionUuid,
            templateUuid: templateUuid,
            config: {},
        });

        // 2. Call Webhook Endpoint
        const hookResponse = await fetch(
            `${DEFAULT_URL}/hooks/actions/${trigger.uuid}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'kleinkram-client-version': appVersion,
                },
                body: JSON.stringify({ key: 'value' }),
            },
        );

        expect(hookResponse.status).toBe(201);
        const hookData = (await hookResponse.json()) as {
            actionUUID: string;
            templateUUID: string;
            state: string;
            createdAt: string;
        };
        expect(hookData.actionUUID).toBeDefined();
        expect(hookData.templateUUID).toBe(templateUuid);
        expect(hookData.state).toBe('PENDING');
        expect(hookData.createdAt).toBeDefined();
        expect(new Date(hookData.createdAt).getTime()).not.toBeNaN();

        // 3. Verify Action exists in DB
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOne({
            where: { uuid: hookData.actionUUID },
            relations: ['template', 'mission'],
        });

        expect(action).toBeDefined();
        expect(action?.template?.uuid).toBe(templateUuid);
        expect(action?.mission?.uuid).toBe(missionUuid);
    });

    describe('File Event Triggers', () => {
        test('should match *.bag pattern for test.bag', async () => {
            await createTrigger({
                name: 'Bag Trigger',
                description: 'Matches *.bag files',
                type: TriggerType.FILE,
                missionUuid: missionUuid,
                templateUuid: templateUuid,
                config: {
                    patterns: ['*.bag'],
                    event: [TriggerEvent.UPLOAD],
                },
            });

            const file = await createMockFile('test.bag');
            const actionRepo = database.getRepository(ActionEntity);
            const countBefore = await actionRepo.count();

            await simulateFileEventJob(file.uuid, TriggerEvent.UPLOAD);

            const countAfter = await actionRepo.count();
            expect(countAfter).toBe(countBefore + 1);
        });

        test('should NOT match *.bag pattern for test.yml', async () => {
            await createTrigger({
                name: 'Bag Trigger',
                description: 'Matches *.bag files',
                type: TriggerType.FILE,
                missionUuid: missionUuid,
                templateUuid: templateUuid,
                config: {
                    patterns: ['*.bag'],
                    event: [TriggerEvent.UPLOAD],
                },
            });

            const file = await createMockFile('test.yml');
            const actionRepo = database.getRepository(ActionEntity);
            const countBefore = await actionRepo.count();

            await simulateFileEventJob(file.uuid, TriggerEvent.UPLOAD);

            const countAfter = await actionRepo.count();
            expect(countAfter).toBe(countBefore); // No new action
        });

        test('should match some_*.bag pattern for some_test.bag', async () => {
            await createTrigger({
                name: 'Some Bag Trigger',
                description: 'Matches some_*.bag files',
                type: TriggerType.FILE,
                missionUuid: missionUuid,
                templateUuid: templateUuid,
                config: {
                    patterns: ['some_*.bag'],
                    event: [TriggerEvent.UPLOAD],
                },
            });

            const file = await createMockFile('some_test.bag');
            const actionRepo = database.getRepository(ActionEntity);
            const countBefore = await actionRepo.count();

            await simulateFileEventJob(file.uuid, TriggerEvent.UPLOAD);

            const countAfter = await actionRepo.count();
            expect(countAfter).toBe(countBefore + 1);
        });

        test('should match * pattern for any file', async () => {
            await createTrigger({
                name: 'All Files Trigger',
                description: 'Matches all files',
                type: TriggerType.FILE,
                missionUuid: missionUuid,
                templateUuid: templateUuid,
                config: {
                    patterns: ['*'],
                    event: [TriggerEvent.UPLOAD],
                },
            });

            const file = await createMockFile('data.json');
            const actionRepo = database.getRepository(ActionEntity);
            const countBefore = await actionRepo.count();

            await simulateFileEventJob(file.uuid, TriggerEvent.UPLOAD);

            const countAfter = await actionRepo.count();
            expect(countAfter).toBe(countBefore + 1);
        });

        test('should match specific filename test.yml', async () => {
            await createTrigger({
                name: 'Specific File Trigger',
                description: 'Matches test.yml only',
                type: TriggerType.FILE,
                missionUuid: missionUuid,
                templateUuid: templateUuid,
                config: {
                    patterns: ['test.yml'],
                    event: [TriggerEvent.UPLOAD],
                },
            });

            const file = await createMockFile('test.yml');
            const actionRepo = database.getRepository(ActionEntity);
            const countBefore = await actionRepo.count();

            await simulateFileEventJob(file.uuid, TriggerEvent.UPLOAD);

            const countAfter = await actionRepo.count();
            expect(countAfter).toBe(countBefore + 1);
        });
    });

    describe('Creator Association', () => {
        it('should associate the trigger with the correct creator', async () => {
            const trigger = await createTrigger({
                name: 'Creator Test Trigger',
                description: 'Verifies creator association',
                templateUuid: templateUuid,
                missionUuid: missionUuid,
                type: TriggerType.WEBHOOK,
                config: {},
            });

            const response = await fetch(
                `${DEFAULT_URL}/triggers?missionUuid=${missionUuid}`,
                {
                    method: 'GET',
                    headers: new HeaderCreator(user).getHeaders(),
                },
            );

            expect(response.status).toBe(200);
            const triggers = (await response.json()) as ActionTriggerDto[];
            const createdTrigger = triggers.find(
                (t) => t.uuid === trigger.uuid,
            );

            expect(createdTrigger).toBeDefined();
            expect(createdTrigger?.creatorUuid).toBe(user.uuid);
            expect(createdTrigger?.creatorName).toBe(user.name);
        });
    });
});
