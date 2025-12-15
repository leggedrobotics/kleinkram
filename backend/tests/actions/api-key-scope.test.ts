// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../global.d.ts" />
import { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import { SubmitActionDto } from '@kleinkram/api-dto/types/submit-action-response.dto';
import {
    AccessGroupEntity,
    ActionEntity,
    ActionTemplateEntity,
    ApiKeyEntity,
    MissionEntity,
    ProjectEntity,
    UserEntity,
    WorkerEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';

describe('Verify Action API Key Scope', () => {
    const createTemplateViaApi = async (
        user: UserEntity,
        dto: CreateTemplateDto,
        // eslint-disable-next-line unicorn/consistent-function-scoping
    ) => {
        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify(dto),
        });

        if (response.status >= 300) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Failed to create template: ${response.status} ${response.statusText}`,
            );
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return response.json();
    };

    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // Create internal user (Creator)
        ({
            user: globalThis.creator,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.creator.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
    });

    beforeEach(async () => {
        // 1. Setup Access Groups
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.creator.name },
        });

        // 2. Generate Project
        globalThis.projectUuid = await createProjectUsingPost(
            {
                name: 'scope_test_project',
                description: 'Project for scope testing',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // 3. Create Mission
        globalThis.missionUuid = await createMissionUsingPost(
            {
                name: 'scope_test_mission',
                projectUUID: globalThis.projectUuid,
                tags: {},
                ignoreTags: true,
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // 4. Create Action Template
        const templateDto: CreateTemplateDto = {
            name: 'scope_test_template',
            description: 'Template for scope testing',
            command: '',
            cpuCores: 1,
            cpuMemory: 1,
            entrypoint: 'd',
            gpuMemory: -1,
            dockerImage: 'rslethz/test',
            accessRights: AccessGroupRights.READ, // Minimal rights
            maxRuntime: 1,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const createdTemplate = await createTemplateViaApi(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
            templateDto,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        globalThis.templateUuid = createdTemplate.uuid;

        // 5. Create a Worker
        const workerRepo = database.getRepository(WorkerEntity);
        const worker = workerRepo.create({
            identifier: 'test-worker-id',
            hostname: 'test-host',
            reachable: true,
            lastSeen: new Date(),
            cpuMemory: 1000,
            cpuCores: 4,
            cpuModel: 'test-cpu',
            storage: 1000,
            gpuMemory: -1,
        });
        await workerRepo.save(worker);

        // Initialize queue for this worker (normally done by ActionDispatcherService.onModuleInit)
        // The healthCheck cron runs every 30 seconds and will initialize queues for new workers
        // We need to wait for it to run at least once
        // await new Promise((resolve) => setTimeout(resolve, 35000));
    }, 40_000); // 40-second timeout for beforeEach

    afterEach(async () => {
        const repos = [
            { name: 'Actions', entity: ActionEntity },
            { name: 'Templates', entity: ActionTemplateEntity },
            { name: 'Missions', entity: MissionEntity },
            { name: 'Projects', entity: ProjectEntity },
            { name: 'ApiKeys', entity: ApiKeyEntity },
            { name: 'Workers', entity: WorkerEntity },
        ];

        for (const repo of repos) {
            const repository = database.getRepository(repo.entity);
            const items = await repository.find();
            if (items.length > 0) {
                await repository.remove(items);
            }
        }
    });

    afterAll(async () => {
        if (database.isInitialized) {
            await database.destroy();
        }
    });

    test('if an action API key can access its own project', async () => {
        // 1. Submit Action
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headers = new HeaderCreator(globalThis.creator);
        headers.addHeader('Content-Type', 'application/json');
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                missionUUID: globalThis.missionUuid,
                templateUUID: globalThis.templateUuid,
            } as SubmitActionDto),
        });
        expect(submitResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { actionUUID: uuid } = await submitResponse.json();

        // 2. Get the API Key for the action (simulating worker retrieval or internal logic)
        // Since we removed the automatic creation in the dispatcher, we need to manually create it here
        // to simulate the worker creating it upon execution start.
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { uuid },
        });

        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: globalThis.missionUuid },
            action: action,
            rights: AccessGroupRights.READ,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            user: globalThis.creator,
        });
        await apiKeyRepo.save(apiKeyEntity);
        const apiKey = apiKeyEntity.apikey;

        // 3. Use API Key to fetch project details
        const projectResponse = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}`,
            {
                method: 'GET',

                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'x-api-key': apiKey,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        expect(projectResponse.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const project = await projectResponse.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(project.uuid).toBe(globalThis.projectUuid);
    });

    test('if an action API key CANNOT access other projects', async () => {
        // 1. Create another project (Alien Project)
        const alienProjectUuid = await createProjectUsingPost(
            {
                name: 'alien_project',
                description: 'Alien project',
                requiredTags: [],
                accessGroups: [], // No access for creator needed for this test specifically, but api requires it usually.
                // Actually, let's just create it with creator so it exists.
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // 2. Submit Action in the original project
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headers = new HeaderCreator(globalThis.creator);
        headers.addHeader('Content-Type', 'application/json');
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                missionUUID: globalThis.missionUuid,
                templateUUID: globalThis.templateUuid,
            } as SubmitActionDto),
        });
        expect(submitResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { actionUUID: uuid } = await submitResponse.json();

        // 3. Get API Key
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { uuid },
        });

        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: globalThis.missionUuid },
            action: action,
            rights: AccessGroupRights.READ,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            user: globalThis.creator,
        });
        await apiKeyRepo.save(apiKeyEntity);
        const apiKey = apiKeyEntity.apikey;

        // 4. Try to access Alien Project
        const projectResponse = await fetch(
            `${DEFAULT_URL}/projects/${alienProjectUuid}`,

            {
                method: 'GET',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'x-api-key': apiKey,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        expect(projectResponse.status).toBe(403); // Forbidden
    });
});
