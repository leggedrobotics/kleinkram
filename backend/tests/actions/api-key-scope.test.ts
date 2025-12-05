import { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import { SubmitActionDto } from '@kleinkram/api-dto/types/submit-action-response.dto';
import { AccessGroupRights, KeyTypes } from '@kleinkram/backend-common';
import { ActionTemplateEntity } from '@kleinkram/backend-common/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/action/action.entity';
import { ApikeyEntity } from '@kleinkram/backend-common/auth/apikey.entity';
import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { ProjectEntity } from '@kleinkram/backend-common/project/project.entity';
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
                `Failed to create template: ${response.status} ${response.statusText}`,
            );
        }
        return response.json();
    };

    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // Create internal user (Creator)
        ({
            user: globalThis.creator as UserEntity,
            token: globalThis.creator.token,
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
    });

    beforeEach(async () => {
        // 1. Setup Access Groups
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
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

        const createdTemplate = await createTemplateViaApi(
            globalThis.creator,
            templateDto,
        );
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
            { name: 'ApiKeys', entity: ApikeyEntity },
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

    test('if an action API key can access its own project', async () => {
        // 1. Submit Action
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
        const { actionUUID: uuid } = await submitResponse.json();

        // 2. Get the API Key for the action (simulating worker retrieval or internal logic)
        // Since we removed the automatic creation in the dispatcher, we need to manually create it here
        // to simulate the worker creating it upon execution start.
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOneOrFail({
            where: { uuid },
        });

        const apiKeyRepo = database.getRepository(ApikeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            key_type: KeyTypes.ACTION,
            mission: { uuid: globalThis.missionUuid },
            action: action,
            rights: AccessGroupRights.READ,
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
                    'x-api-key': apiKey,
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        expect(projectResponse.status).toBe(200);
        const project = await projectResponse.json();
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
            globalThis.creator,
        );

        // 2. Submit Action in the original project
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
        const { actionUUID: uuid } = await submitResponse.json();

        // 3. Get API Key
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOneOrFail({
            where: { uuid },
        });

        const apiKeyRepo = database.getRepository(ApikeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            key_type: KeyTypes.ACTION,
            mission: { uuid: globalThis.missionUuid },
            action: action,
            rights: AccessGroupRights.READ,
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
                    'x-api-key': apiKey,
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        expect(projectResponse.status).toBe(403); // Forbidden
    });
});
