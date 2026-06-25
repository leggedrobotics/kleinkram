import {
    ApiKeyEntity,
    FileEntity,
    MissionEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
    uploadFile,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('Comprehensive API Query Parameters Tests', () => {
    setupDatabaseHooks();

    test('should support all project query parameters (take, skip, sortBy, sortOrder, projectUuids, projectPatterns, creatorUuid, exactMatch)', async () => {
        const { user, projectUuid } = await setupTestEnvironment(
            'proj-params@kleinkram.dev',
            'Project Params User',
        );

        // 1. Create a second project for sorting/filtering tests
        await createProjectUsingPost(
            {
                name: 'another_project_for_sorting',
                description: 'another desc',
                requiredTags: [],
            },
            user,
        );

        // 2. Fetch projects with sortBy=name and sortOrder=ASC
        const response1 = await fetch(
            `${DEFAULT_URL}/projects?take=10&skip=0&sortBy=name&sortOrder=asc`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response1.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json1 = await response1.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data.length).toBe(2);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data[0].name).toBe('another_project_for_sorting'); // 'a' comes before 't'

        // 3. Fetch projects with sortBy=rights and sortOrder=asc
        const responseRights = await fetch(
            `${DEFAULT_URL}/projects?take=10&skip=0&sortBy=rights&sortOrder=asc`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(responseRights.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const jsonRights = await responseRights.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(jsonRights.data.length).toBe(2);

        // 4. Filter by projectUuids
        const response2 = await fetch(
            `${DEFAULT_URL}/projects?projectUuids=${projectUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response2.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json2 = await response2.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data[0].uuid).toBe(projectUuid);

        // 5. Filter by projectPatterns
        const response3 = await fetch(
            `${DEFAULT_URL}/projects?projectPatterns=another`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response3.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json3 = await response3.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json3.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json3.data[0].name).toBe('another_project_for_sorting');

        // 6. Filter by creatorUuid
        const response4 = await fetch(
            `${DEFAULT_URL}/projects?creatorUuid=${user.uuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response4.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json4 = await response4.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json4.data.length).toBe(2);

        // 7. Filter by exactMatch=true
        const response5 = await fetch(
            `${DEFAULT_URL}/projects?projectPatterns=another_project_for_sorting&exactMatch=true`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response5.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json5 = await response5.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json5.data.length).toBe(1);
    });

    test('should support all mission query parameters (take, skip, sortBy, sortDirection, projectUuid, uuid, missionUuids, missionPatterns, minimal)', async () => {
        const { user, projectUuid, missionUuid } = await setupTestEnvironment(
            'mission-params@kleinkram.dev',
            'Mission Params User',
        );

        // 1. Create a second mission for sorting/filtering tests
        await createMissionUsingPost(
            {
                name: 'another_mission_for_sorting',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        // 2. Fetch missions with sortBy=name and sortDirection=ASC
        const response1 = await fetch(
            `${DEFAULT_URL}/missions?take=10&skip=0&sortBy=name&sortDirection=ASC&projectUuid=${projectUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response1.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json1 = await response1.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data.length).toBe(2);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data[0].name).toBe('another_mission_for_sorting'); // 'a' comes before 't'

        // 3. Filter by missionUuids
        const response2 = await fetch(
            `${DEFAULT_URL}/missions?missionUuids=${missionUuid}&projectUuid=${projectUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response2.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json2 = await response2.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data[0].uuid).toBe(missionUuid);

        // 4. Filter by missionPatterns
        const response3 = await fetch(
            `${DEFAULT_URL}/missions?missionPatterns=*another*&projectUuid=${projectUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response3.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json3 = await response3.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json3.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json3.data[0].name).toBe('another_mission_for_sorting');

        // 5. Test minimal parameter
        const response4 = await fetch(
            `${DEFAULT_URL}/missions?minimal=true&projectUuid=${projectUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response4.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json4 = await response4.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json4.data.length).toBe(2);
        // minimal returns minimal fields
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json4.data[0]).toHaveProperty('uuid');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json4.data[0]).toHaveProperty('name');
    });

    test('should support all file query parameters (fileUuids, filePatterns, fileExtensions, topicPatterns, categoryPatterns, fileName, projectUUID, missionUUID, startDate, endDate, sort)', async () => {
        const { user, projectUuid, missionUuid } = await setupTestEnvironment(
            'file-params@kleinkram.dev',
            'File Params User',
        );

        // Upload files
        await uploadFile(user, 'test.bag', missionUuid);
        await uploadFile(user, 'file1.bag', missionUuid);

        // Verify files are registered in DB
        const fileRepo = database.getRepository(FileEntity);
        const files = await fileRepo.find({
            where: { mission: { uuid: missionUuid } },
        });
        expect(files.length).toBe(2);

        // 1. Filter by fileUuids
        const file1 = files[0];
        const response1 = await fetch(
            `${DEFAULT_URL}/files?fileUuids=${file1.uuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response1.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json1 = await response1.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json1.data[0].uuid).toBe(file1.uuid);

        // 2. Filter by filePatterns
        const response2 = await fetch(
            `${DEFAULT_URL}/files?filePatterns=*test*`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response2.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json2 = await response2.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json2.data[0].filename).toBe('test.bag');

        // 3. Filter by fileExtensions
        const response3 = await fetch(
            `${DEFAULT_URL}/files?fileExtensions=bag`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response3.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json3 = await response3.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json3.data.length).toBe(2);

        // 4. Filter by projectUUID and missionUUID
        const response4 = await fetch(
            `${DEFAULT_URL}/files?projectUUID=${projectUuid}&missionUUID=${missionUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response4.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json4 = await response4.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json4.data.length).toBe(2);

        // 5. Filter by startDate / endDate
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const response5 = await fetch(
            `${DEFAULT_URL}/files?startDate=1969-01-01T00:00:00.000Z&endDate=${tomorrow.toISOString()}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response5.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json5 = await response5.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json5.data.length).toBe(2);

        // 6. Test sorting
        const response6 = await fetch(
            `${DEFAULT_URL}/files?sort=filename&sortOrder=asc`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response6.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json6 = await response6.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json6.data[0].filename).toBe('file1.bag');
    });

    test('should support file storage/upload/queue endpoints (isUploading, queue, storage)', async () => {
        const { user } = await setupTestEnvironment(
            'file-endpoints@kleinkram.dev',
            'File Endpoints User',
        );

        // 1. GET /files/isUploading
        const responseIsUploading = await fetch(
            `${DEFAULT_URL}/files/isUploading`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(responseIsUploading.status).toBe(200);

        // 2. GET /files/storage
        const responseStorage = await fetch(`${DEFAULT_URL}/files/storage`, {
            method: 'GET',
            headers: getAuthHeaders(user),
        });
        expect(responseStorage.status).toBe(200);

        // 3. GET /files/queue
        const responseQueue = await fetch(
            `${DEFAULT_URL}/files/queue?startDate=2026-01-01T00:00:00.000Z&skip=0&take=10`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(responseQueue.status).toBe(200);
    });

    test('should support API keys query parameters (take, skip, sortBy, sortOrder)', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'api-keys-params@kleinkram.dev',
            'API Keys Params User',
        );

        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneOrFail({
            where: { uuid: missionUuid },
        });

        // Create an API key
        const apiKeyRepo = database.getRepository(ApiKeyEntity);
        const key = apiKeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: mission,
            rights: AccessGroupRights.READ,
            user: user,
        });
        await apiKeyRepo.save(key);

        // Query API keys
        const response = await fetch(
            `${DEFAULT_URL}/users/me/api-keys?take=20&skip=0&sortBy=createdAt&sortOrder=ASC`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json.data.length).toBe(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(json.data[0].uuid).toBe(key.uuid);
    });
});
