import { CreateTemplateDto } from '@common/api/types/actions/create-template.dto';
import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import UserEntity from '@common/entities/user/user.entity';
import {
    AccessGroupRights,
    ActionState,
    KeyTypes,
} from '@common/frontend_shared/enum';
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
            `Failed to create template: ${response.status} ${response.statusText}`,
        );
    }
    return response.json();
};

describe('Verify Action Access Rights', () => {
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
        const createdTemplate = await createTemplateViaApi(
            globalThis.creator,
            templateDto,
        );
        console.log('DEBUG: createdTemplate', createdTemplate);
        globalThis.templateUuid = createdTemplate.uuid;

        // 4. Create Mission
        globalThis.missionUuid = await createMissionUsingPost(
            {
                name: 'rights_test_mission',
                projectUUID: globalThis.projectUuid,
                tags: {},
                ignoreTags: true,
            },
            globalThis.creator,
        );
    });

    afterEach(async () => {
        const repos = [
            { name: 'Actions', entity: ActionEntity },
            { name: 'Templates', entity: ActionTemplateEntity },
            { name: 'Missions', entity: MissionEntity },
            { name: 'Projects', entity: ProjectEntity },
            { name: 'ApiKeys', entity: ApikeyEntity },
        ];

        for (const repo of repos) {
            const repository = database.getRepository(repo.entity);
            const items = await repository.find();
            if (items.length > 0) {
                await repository.remove(items);
            }
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
            creator: globalThis.creator,
            state: ActionState.PROCESSING,
            template: template,
        });
        await actionRepo.save(action);

        const apiKeyRepo = database.getRepository(ApikeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            key_type: KeyTypes.ACTION,
            mission: mission,
            action: action,
            rights: AccessGroupRights.READ,
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
                    'x-api-key': apiKey,
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
            creator: globalThis.creator,
            state: ActionState.PROCESSING,
            template: template,
        });
        await actionRepo.save(action);

        const apiKeyRepo = database.getRepository(ApikeyEntity);
        const apiKeyEntity = apiKeyRepo.create({
            key_type: KeyTypes.ACTION,
            mission: mission,
            action: action,
            rights: AccessGroupRights.READ,
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
                    'x-api-key': apiKey,
                    'kleinkram-client-version': '0.56.0',
                },
            },
        );

        expect(getResponse.status).toBe(200);
    });
});
