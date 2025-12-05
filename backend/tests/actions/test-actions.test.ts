import { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import { SubmitActionDto } from '@kleinkram/api-dto/types/submit-action-response.dto';
import {
    AccessGroupEntity,
    AccessGroupRights,
    ActionEntity,
    ActionState,
    ActionTemplateEntity,
    MissionEntity,
    ProjectEntity,
    UserEntity,
    WorkerEntity,
} from '@kleinkram/backend-common';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';

describe('Verify Action (Templates & Runs)', () => {
    // Helper to create a template via API (simulating frontend behavior)
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

        console.log(`[DEBUG]: Global url: ${DEFAULT_URL}`);

        // Create internal user (Creator)
        ({
            user: globalThis.creator as UserEntity,
            token: globalThis.creator.token,
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));

        // Create 2nd internal user (Standard User)
        ({
            user: globalThis.user as UserEntity,
            token: globalThis.userToken,
            response: globalThis.userResponse,
        } = await generateAndFetchDatabaseUser('internal', 'user'));

        // Create external user
        ({
            user: globalThis.externalUser as UserEntity,
            token: globalThis.externalUser.token,
            response: globalThis.externalUser.response,
        } = await generateAndFetchDatabaseUser('external', 'user'));

        // Create admin user
        ({
            user: globalThis.admin as UserEntity,
            token: globalThis.admin.token,
            response: globalThis.admin.response,
        } = await generateAndFetchDatabaseUser('internal', 'admin'));

        // Create Worker
        const workerRepo = database.getRepository(WorkerEntity);
        const worker = workerRepo.create({
            identifier: `test-worker-actions-id-${Date.now()}`,
            hostname: 'test-host-actions',
            reachable: true,
            lastSeen: new Date(),
            cpuMemory: 1000,
            cpuCores: 4,
            cpuModel: 'test-cpu',
            storage: 1000,
            gpuMemory: -1,
        });
        await workerRepo.save(worker);

        // Initialize queue for this worker
        // await new Promise((resolve) => setTimeout(resolve, 35000));
    });

    beforeEach(async () => {
        // 1. Setup Access Groups
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
        });

        // 2. Generate Project
        // Creator has DELETE rights, User has CREATE rights
        globalThis.projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: accessGroupUser.uuid,
                    },
                ],
            },
            globalThis.creator,
        );

        // 3. Create Mission
        globalThis.missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: globalThis.projectUuid,
                tags: {},
                ignoreTags: true,
            },
            globalThis.creator,
        );

        // 4. Create Action Template (Using the new API endpoint)
        const templateDto: CreateTemplateDto = {
            name: 'test_action_template',
            description: 'Test action template used in integration test',
            command: '',
            cpuCores: 2,
            cpuMemory: 2,
            entrypoint: 'd',
            gpuMemory: -1,
            dockerImage: 'rslethz/test',
            accessRights: AccessGroupRights.DELETE, // Restricted rights
            maxRuntime: 1,
        };

        const createdTemplate = await createTemplateViaApi(
            globalThis.creator,
            templateDto,
        );
        globalThis.templateUuid = createdTemplate.uuid;

        console.log(
            `[DEBUG]: Template created with UUID: ${globalThis.templateUuid}`,
        );
    });

    afterEach(async () => {
        // Cleanup entities
        const repos = [
            { name: 'Actions', entity: ActionEntity },
            { name: 'Templates', entity: ActionTemplateEntity },
            { name: 'Missions', entity: MissionEntity },
            { name: 'Projects', entity: ProjectEntity },
        ];

        for (const repo of repos) {
            const repository = database.getRepository(repo.entity);
            const items = await repository.find();
            if (items.length > 0) {
                await repository.remove(items);
            }
            console.log(`[DEBUG]: All ${repo.name} removed.`);
        }
    });

    test('if a internal user with rights can create a action template', async () => {
        // Verification is essentially done in beforeEach, but we verify DB state here
        const templateRepository =
            database.getRepository<ActionTemplateEntity>(ActionTemplateEntity);
        const template = await templateRepository.findOneOrFail({
            where: { uuid: globalThis.templateUuid },
        });

        expect(template.name).toBe('test_action_template');
        expect(template.image_name).toBe('rslethz/test');
    });

    test('if a internal user with rights can submit (dispatch) an action', async () => {
        const headersBuilder = new HeaderCreator(globalThis.creator);
        headersBuilder.addHeader('Content-Type', 'application/json');

        // New Endpoint: POST /actions
        const response = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                missionUUID: globalThis.missionUuid,
                templateUUID: globalThis.templateUuid,
            } as SubmitActionDto),
        });

        const json = await response.json();
        expect(response.status).toBeLessThan(300);
        expect(json).toHaveProperty('actionUUID');
        const uuid = json.actionUUID;
        console.log('[DEBUG] Assigned UUID:', uuid);

        // Verify in DB
        const actionRepo = database.getRepository(ActionEntity);
        const savedAction = await actionRepo.findOne({
            where: { uuid: json.uuid },
        });
        expect(savedAction).toBeDefined();
    });

    test('if a user can view details of a submitted action', async () => {
        // Debug: Check /user/me
        const meResponse = await fetch(`${DEFAULT_URL}/user/me`, {
            method: 'GET',
            headers: new HeaderCreator(globalThis.creator).getHeaders(),
        });
        const me = await meResponse.json();
        console.log('[DEBUG] /user/me:', me);

        // 1. Submit Action first
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
        if (submitResponse.status !== 201) {
            console.log('[DEBUG] Submit error:', await submitResponse.text());
        }
        expect(submitResponse.status).toBe(201);
        const submitJson = await submitResponse.json();
        console.log('[DEBUG] Submit JSON:', submitJson);
        const { actionUUID: uuid } = submitJson;

        // 2. Fetch Details (GET /actions/:uuid)
        const detailsResponse = await fetch(`${DEFAULT_URL}/actions/${uuid}`, {
            method: 'GET',
            headers: new HeaderCreator(globalThis.creator).getHeaders(),
        });

        if (detailsResponse.status !== 200) {
            console.log('[DEBUG] Details error:', await detailsResponse.text());
        }
        expect(detailsResponse.status).toBe(200);
        const details: ActionDto = await detailsResponse.json();
        expect(details.uuid).toBe(uuid);
        expect(details.template.name).toBe('test_action_template');
    });

    test('if a user can get logs of a submitted action', async () => {
        // 1. Submit Action first
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

        // 2. Fetch Logs (GET /actions/:uuid/logs)
        const logsResponse = await fetch(
            `${DEFAULT_URL}/actions/${uuid}/logs?skip=0&take=10`,
            {
                method: 'GET',
                headers: new HeaderCreator(globalThis.creator).getHeaders(),
            },
        );

        expect(logsResponse.status).toBe(200);
        const logs = await logsResponse.json();
        expect(logs).toHaveProperty('data');
        expect(logs).toHaveProperty('count');
        expect(Array.isArray(logs.data)).toBe(true);
        // If there are logs, verify their structure
        if (logs.data.length > 0) {
            const log = logs.data[0];
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('message');
            expect(log).toHaveProperty('type');
        }
    });

    test('if a user can batch submit actions', async () => {
        // POST /actions/batch
        const headers = new HeaderCreator(globalThis.creator);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/actions/batch`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                missionUUIDs: [globalThis.missionUuid],
                templateUUID: globalThis.templateUuid,
            }),
        });

        expect(response.status).toBe(201);
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
        expect(json.length).toBe(1);
        expect(json[0]).toHaveProperty('actionUUID');
    });

    test('if a user can list all actions', async () => {
        // GET /actions
        const response = await fetch(`${DEFAULT_URL}/actions?skip=0&take=10`, {
            method: 'GET',
            headers: new HeaderCreator(globalThis.creator).getHeaders(),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('count');
    });

    test('if a user with DELETE rights can delete an action run', async () => {
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

        // Force update action state to DONE so it can be deleted
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update({ uuid }, { state: ActionState.DONE });

        // 2. Delete Action (DELETE /actions/:uuid)
        const deleteResponse = await fetch(`${DEFAULT_URL}/actions/${uuid}`, {
            method: 'DELETE',
            headers: new HeaderCreator(globalThis.creator).getHeaders(),
        });

        expect(deleteResponse.status).toBe(200);

        // 3. Verify deletion in DB
        const deletedAction = await actionRepo.findOne({ where: { uuid } });
        expect(deletedAction).toBeNull();
    });

    test('if an admin can list all action templates', async () => {
        // New Endpoint: GET /templates
        const response = await fetch(
            `${DEFAULT_URL}/templates?skip=0&take=10`,
            {
                method: 'GET',
                headers: new HeaderCreator(globalThis.admin).getHeaders(),
            },
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.data.length).toBeGreaterThanOrEqual(1);
        expect(json.data[0].name).toBe('test_action_template');
    });

    // Permission Test Example
    test('if a user WITHOUT rights cannot delete an action', async () => {
        // 1. Creator submits action (Creator has DELETE rights on project)
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
        if (submitResponse.status !== 201) {
            console.log('[DEBUG] Submit error:', await submitResponse.text());
        }
        expect(submitResponse.status).toBe(201);
        const { actionUUID: uuid } = await submitResponse.json();

        // Force update action state to DONE so it can be deleted
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update({ uuid }, { state: ActionState.DONE });

        // 2. External User tries to delete it (Assuming External has no rights)
        const deleteResponse = await fetch(`${DEFAULT_URL}/actions/${uuid}`, {
            method: 'DELETE',
            headers: new HeaderCreator(globalThis.externalUser).getHeaders(),
        });

        expect(deleteResponse.status).toBe(403); // Assuming Forbidden
    });
});
