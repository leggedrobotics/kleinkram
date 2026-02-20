import {
    AccessGroupEntity,
    ActionTemplateEntity,
    ApiKeyEntity,
    CategoryEntity,
    FileEntity,
    MissionEntity,
    ProjectEntity,
    UserEntity,
    WorkerEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, FileType, KeyTypes } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';

interface ApiResponse<T> {
    data: T;
}

interface ProjectData {
    uuid: string;
    name: string;
}

describe('Comprehensive Soft Delete Behavior', () => {
    let admin: UserEntity;
    let creator: UserEntity;
    let accessGroupCreator: AccessGroupEntity;

    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // Create users
        ({ user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        ));
        ({ user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        ));

        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });
    });

    afterAll(async () => {
        await clearAllData();
        await database.destroy();
    });

    beforeEach(async () => {
        await clearAllData();
        // Re-mock users after clear because clearAllData clears everything except workers
        ({ user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        ));
        ({ user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        ));
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });
    });

    test('Project soft delete and re-creation', async () => {
        const projectName = 'SoftDeleteProject';
        const projectRequest = {
            name: projectName,
            description: 'A project to be soft-deleted',
            requiredTags: [],
            accessGroups: [
                {
                    rights: AccessGroupRights.DELETE,
                    accessGroupUUID: accessGroupCreator.uuid,
                },
            ],
        };

        // 1. Create Project
        const uuid = await createProjectUsingPost(projectRequest, creator);

        // 2. Soft-delete Project via API
        const header = new HeaderCreator(creator);
        const deleteResponse = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
            method: 'DELETE',
            headers: header.getHeaders(),
        });
        expect(deleteResponse.status).toBe(200);

        // 3. Verify it is not returned in listing
        const listResponse = await fetch(`${DEFAULT_URL}/projects`, {
            method: 'GET',
            headers: header.getHeaders(),
        });
        const listJson = (await listResponse.json()) as ApiResponse<
            ProjectData[]
        >;
        expect(listJson.data.find((p) => p.uuid === uuid)).toBeUndefined();

        // 4. Verify it still exists in DB but is soft-deleted (not returned by default queries)
        const projectRepo = database.getRepository(ProjectEntity);
        const dbProjectWithDeleted = await projectRepo.findOne({
            where: { uuid },
            withDeleted: true,
        });
        expect(dbProjectWithDeleted).toBeDefined();
        const dbProjectWithoutDeleted = await projectRepo.findOne({
            where: { uuid },
        });
        expect(dbProjectWithoutDeleted).toBeNull();

        // 5. Re-create project with SAME NAME
        const newUuid = await createProjectUsingPost(projectRequest, creator);
        expect(newUuid).not.toBe(uuid);

        // 6. Verify listing shows the NEW project
        const listResponse2 = await fetch(`${DEFAULT_URL}/projects`, {
            method: 'GET',
            headers: header.getHeaders(),
        });
        const listJson2 = (await listResponse2.json()) as ApiResponse<
            ProjectData[]
        >;
        const found = listJson2.data.find((p) => p.uuid === newUuid);
        expect(found).toBeDefined();
        expect(found?.name).toBe(projectName);
    });

    test('Mission soft delete and re-creation', async () => {
        // Setup project
        const projectUuid = await createProjectUsingPost(
            {
                name: 'MissionProject',
                description: 'desc',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            creator,
        );

        const missionName = 'SoftDeleteMission';
        const missionRequest = {
            name: missionName,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        };

        // 1. Create Mission
        const missionUuid = await createMissionUsingPost(
            missionRequest,
            creator,
        );

        // 2. Soft-delete Mission via API
        const header = new HeaderCreator(creator);
        const deleteResponse = await fetch(
            `${DEFAULT_URL}/mission/${missionUuid}`,
            {
                method: 'DELETE',
                headers: header.getHeaders(),
            },
        );
        expect(deleteResponse.status).toBe(200);

        // 3. Verify it still exists in DB but is soft-deleted (not returned by default queries)
        const missionRepo = database.getRepository(MissionEntity);
        const dbMissionWithDeleted = await missionRepo.findOne({
            where: { uuid: missionUuid },
            withDeleted: true,
        });
        expect(dbMissionWithDeleted).toBeDefined();
        const dbMissionWithoutDeleted = await missionRepo.findOne({
            where: { uuid: missionUuid },
        });
        expect(dbMissionWithoutDeleted).toBeNull();

        // 4. Re-create mission with SAME NAME in SAME project
        const newMissionUuid = await createMissionUsingPost(
            missionRequest,
            creator,
        );
        expect(newMissionUuid).not.toBe(missionUuid);

        // 5. Verify listing works
        const missionResponse = await missionRepo.find({
            where: { project: { uuid: projectUuid } },
        });
        expect(missionResponse.length).toBe(1);
        expect(missionResponse[0].uuid).toBe(newMissionUuid);
    });

    test('File soft delete and re-creation', async () => {
        const projectUuid = await createProjectUsingPost(
            {
                name: 'FileProject',
                description: 'desc',
                requiredTags: [],
            },
            admin,
        );

        const missionUuid = await createMissionUsingPost(
            {
                name: 'FileMission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            admin,
        );

        const fileRepo = database.getRepository(FileEntity);
        const filename = 'test_file.mcap';

        // 1. Create File record
        const file = fileRepo.create({
            filename,
            mission: { uuid: missionUuid } as MissionEntity,
            creator: admin,
            date: new Date(),
            type: FileType.MCAP,
            size: 100,
        });
        await fileRepo.save(file);

        // 2. Soft-delete File record
        await fileRepo.softRemove(file);

        // 3. Re-create file with SAME NAME in SAME mission
        const file2 = fileRepo.create({
            filename,
            mission: { uuid: missionUuid } as MissionEntity,
            creator: admin,
            date: new Date(),
            type: FileType.MCAP,
            size: 200,
        });
        await fileRepo.save(file2);

        // 4. Verify both exist in DB
        const allFiles = await fileRepo.find({
            where: { filename },
            withDeleted: true,
        });
        expect(allFiles.length).toBe(2);

        const activeFiles = await fileRepo.find({ where: { filename } });
        expect(activeFiles.length).toBe(1);
        expect(activeFiles[0].uuid).toBe(file2.uuid);
    });

    test('Worker soft delete and re-creation', async () => {
        const workerRepo = database.getRepository(WorkerEntity);
        const identifier = 'test-worker-01';

        const workerData = {
            identifier,
            hostname: 'localhost',
            cpuMemory: 16,
            gpuMemory: 8,
            cpuCores: 8,
            cpuModel: 'Intel',
            storage: 100,
            lastSeen: new Date(),
            reachable: true,
        };

        // 1. Create Worker
        const worker = workerRepo.create(workerData);
        await workerRepo.save(worker);

        // 2. Soft-delete Worker
        await workerRepo.softRemove(worker);

        // 3. Re-create Worker with SAME identifier
        const worker2 = workerRepo.create(workerData);
        await workerRepo.save(worker2);

        // 4. Verify
        const allWorkers = await workerRepo.find({
            where: { identifier },
            withDeleted: true,
        });
        expect(allWorkers.length).toBe(2);
    });

    test('ApiKey soft delete and re-creation', async () => {
        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const projectUuid = await createProjectUsingPost(
            { name: 'KeyProject', description: 'desc', requiredTags: [] },
            admin,
        );
        const missionUuid = await createMissionUsingPost(
            {
                name: 'KeyMission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            admin,
        );

        const apiKeyData = {
            key_type: KeyTypes.ACTION,
            mission: { uuid: missionUuid } as MissionEntity,
            rights: AccessGroupRights.READ,
            user: admin,
        };

        // 1. Create ApiKey
        const key = apiKeyRepo.create(apiKeyData);
        await apiKeyRepo.save(key);
        const apikeyValue = key.apikey;

        // 2. Soft-delete
        await apiKeyRepo.softRemove(key);

        // 3. Re-create with SAME value (using manual assignment for test)
        const key2 = apiKeyRepo.create({ ...apiKeyData, apikey: apikeyValue });
        await apiKeyRepo.save(key2);

        // 4. Verify
        const allKeys = await apiKeyRepo.find({
            where: { apikey: apikeyValue },
            withDeleted: true,
        });
        expect(allKeys.length).toBe(2);
    });

    test('Category soft delete and re-creation', async () => {
        const categoryRepo = database.getRepository(CategoryEntity);
        const projectUuid = await createProjectUsingPost(
            { name: 'CatProject', description: 'desc', requiredTags: [] },
            admin,
        );
        const project = { uuid: projectUuid } as ProjectEntity;

        const catData = {
            name: 'TestCategory',
            project,
            creator: admin,
        };

        // 1. Create
        const cat = categoryRepo.create(catData);
        await categoryRepo.save(cat);

        // 2. Soft-delete
        await categoryRepo.softRemove(cat);

        // 3. Re-create
        const cat2 = categoryRepo.create(catData);
        await categoryRepo.save(cat2);

        // 4. Verify
        const all = await categoryRepo.find({
            where: { name: 'TestCategory', project: { uuid: projectUuid } },
            withDeleted: true,
        });
        expect(all.length).toBe(2);
    });

    test('ActionTemplate soft delete and re-creation', async () => {
        const templateRepo = database.getRepository(ActionTemplateEntity);
        const templateData = {
            name: 'TestAction',
            version: 1,
            image_name: 'test-image',
            creator: admin,
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: 0,
            maxRuntime: 1,
            accessRights: AccessGroupRights.READ,
        };

        // 1. Create
        const template = templateRepo.create(templateData);
        await templateRepo.save(template);

        // 2. Soft-delete
        await templateRepo.softRemove(template);

        // 3. Re-create
        const template2 = templateRepo.create(templateData);
        await templateRepo.save(template2);

        // 4. Verify
        const all = await templateRepo.find({
            where: { name: 'TestAction', version: 1 },
            withDeleted: true,
        });
        expect(all.length).toBe(2);
    });

    test('AccessGroup soft delete and re-creation', async () => {
        const groupRepo = database.getRepository(AccessGroupEntity);
        const groupName = 'TestAccessGroup';

        const groupData = {
            name: groupName,
            creator: admin,
        };

        // 1. Create
        const group = groupRepo.create(groupData);
        await groupRepo.save(group);

        // 2. Soft-delete
        await groupRepo.softRemove(group);

        // 3. Re-create
        const group2 = groupRepo.create(groupData);
        await groupRepo.save(group2);

        // 4. Verify
        const all = await groupRepo.find({
            where: { name: groupName },
            withDeleted: true,
        });
        expect(all.length).toBe(2);
    });
});
