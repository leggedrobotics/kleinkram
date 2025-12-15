// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../global.d.ts" />
import { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
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

import { AccessGroupRights, ActionState, KeyTypes } from '@kleinkram/shared';

import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';

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
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Failed to create template: ${response.status} ${response.statusText}`,
        );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.json();
};

describe('Verify Action Access Rights', () => {
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
                name: 'rights_test_project',
                description: 'Project for rights testing',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE, // User has full rights
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // 3. Create Template
        const templateDto: CreateTemplateDto = {
            name: 'rights_test_template',
            description: 'Template for rights testing',
            // projectUUID removed as it is not in DTO
            dockerImage: 'rslethz/test',
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: -1,
            maxRuntime: 1,
            accessRights: AccessGroupRights.READ,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const createdTemplate = await createTemplateViaApi(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
            templateDto,
        );
        console.log('DEBUG: createdTemplate', createdTemplate);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        globalThis.templateUuid = createdTemplate.uuid;

        // 4. Create Mission
        globalThis.missionUuid = await createMissionUsingPost(
            {
                name: 'rights_test_mission',
                projectUUID: globalThis.projectUuid,
                tags: {},
                ignoreTags: true,
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );
    });

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

    test('if an action with READ rights CANNOT delete a mission', async () => {
        // 1. Manually Create Action and API Key
        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneOrFail({
            where: { uuid: globalThis.missionUuid },
        });

        const templateRepo = database.getRepository(ActionTemplateEntity);
        const template = await templateRepo.findOneOrFail({
            where: { uuid: globalThis.templateUuid },
        });

        const actionRepo = database.getRepository(ActionEntity);
        const action = actionRepo.create({
            mission: mission,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            creator: globalThis.creator,
            state: ActionState.PROCESSING,
            template: template,
        });
        await actionRepo.save(action);

        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: mission,
            action: action,
            rights: AccessGroupRights.READ,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            user: globalThis.creator,
        });
        await apiKeyRepo.save(apiKeyEntity);
        const apiKey = apiKeyEntity.apikey;

        // 2. Try to DELETE the mission using the Action API Key
        const deleteResponse = await fetch(
            `${DEFAULT_URL}/mission/${globalThis.missionUuid}`,
            {
                method: 'DELETE',

                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'x-api-key': apiKey,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        // Should be Forbidden because action only has READ rights
        expect(deleteResponse.status).toBe(403);
    });

    test('if an action with READ rights CAN read a mission', async () => {
        // 1. Manually Create Action and API Key
        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneOrFail({
            where: { uuid: globalThis.missionUuid },
        });

        const templateRepo = database.getRepository(ActionTemplateEntity);
        const template = await templateRepo.findOneOrFail({
            where: { uuid: globalThis.templateUuid },
        });

        const actionRepo = database.getRepository(ActionEntity);
        const action = actionRepo.create({
            mission: mission,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            creator: globalThis.creator,
            state: ActionState.PROCESSING,
            template: template,
        });
        await actionRepo.save(action);

        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: mission,
            action: action,
            rights: AccessGroupRights.READ,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            user: globalThis.creator,
        });
        await apiKeyRepo.save(apiKeyEntity);
        const apiKey = apiKeyEntity.apikey;

        // 2. Try to GET the mission using the Action API Key
        const getResponse = await fetch(
            `${DEFAULT_URL}/mission/one?uuid=${globalThis.missionUuid}`,

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

        expect(getResponse.status).toBe(200);
    });
});
