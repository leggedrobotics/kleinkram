import { FileEventsDto } from '@common/api/types/file/file-event.dto';
import ActionEntity from '@common/entities/action/action.entity';
import FileEntity from '@common/entities/file/file.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import {
    AccessGroupRights,
    CookieNames,
    FileEventType,
    FileState,
    UserRole,
} from '@common/frontend_shared/enum';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
} from '../utils/api-calls';
import {
    clearAllData,
    database,
    getJwtToken,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

describe('Action File Events', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    }, 30000);

    beforeEach(clearAllData);

    afterAll(async () => {
        await database.destroy();
    });

    test('should track file events triggered by an action', async () => {
        // 1. Setup User, Project, Mission
        const userId = await mockDatabaseUser(
            'test@kleinkram.io',
            'Test User',
            UserRole.ADMIN,
        );
        const user = await getUserFromDatabase(userId);
        const projectUuid = await createProjectUsingPost(
            { name: 'test_project', description: 'desc', requiredTags: [] },
            user,
        );
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        // 2. Create Action Template
        const templateUuid = await createActionUsingPost(
            {
                name: 'Test Action',
                description: 'desc',
                accessRights: AccessGroupRights.WRITE, // Needs write access to update file
                dockerImage: 'hello-world',
                maxRuntime: 10,
                cpuCores: 1,
                cpuMemory: 1024,
                gpuMemory: 0,
            },
            user,
        );

        // Submit action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: `authtoken=${await getJwtToken(user)}`,
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const { actionUUID } = await submitResponse.json();

        // 3. Get Action API Key
        const action = await database
            .getRepository(ActionEntity)
            .findOneOrFail({
                where: { uuid: actionUUID },
                relations: ['key'],
            });

        if (!action.key) {
            throw new Error('Action key not found');
        }
        const apiKey = action.key.apikey;

        // 4. Create a File directly in DB
        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneByOrFail({
            uuid: missionUuid,
        });

        const fileRepo = database.getRepository(FileEntity);
        const file = fileRepo.create({
            filename: 'test.txt',
            mission: mission,
            size: 100,
            // bucket: 'data', // bucket does not exist on FileEntity
            hash: 'hash',
            // uploaded: true, // uploaded does not exist on FileEntity? Let's check.
            // It seems I copied properties from somewhere else or guessed them.
            // Let's check FileEntity again.
            // It has state.
            state: FileState.OK,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await fileRepo.save(file);

        // 5. Update File using Action API Key
        const updateResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `${CookieNames.CLI_KEY}=${apiKey}`,
                },
                body: JSON.stringify({
                    filename: 'updated.txt',
                }),
            },
        );
        expect(updateResponse.status).toBe(200);

        // 6. Verify File Event via Action Endpoint
        const eventsResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/file-events`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${await getJwtToken(user)}`,
                },
            },
        );
        expect(eventsResponse.status).toBe(200);
        const events: FileEventsDto = await eventsResponse.json();

        expect(events.count).toBeGreaterThan(0);
        // Find the RENAMED event
        const event = events.data.find((e) => e.type === FileEventType.RENAMED);
        expect(event).toBeDefined();
        expect(event?.action?.uuid).toBe(actionUUID);
        expect(event?.action?.name).toBe('Test Action');
        expect(event?.details['oldFilename']).toBe('test.txt');
        expect(event?.details['newFilename']).toBe('updated.txt');

        // 7. Download File using Action API Key
        const downloadResponse = await fetch(
            `${DEFAULT_URL}/files/download?uuid=${file.uuid}&expires=true`,
            {
                method: 'GET',
                headers: {
                    cookie: `${CookieNames.CLI_KEY}=${apiKey}`,
                },
            },
        );
        expect(downloadResponse.status).toBe(200);

        // 8. Verify Download Event via Action Endpoint
        const eventsResponse2 = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/file-events`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${await getJwtToken(user)}`,
                },
            },
        );
        expect(eventsResponse2.status).toBe(200);
        const events2: FileEventsDto = await eventsResponse2.json();

        const downloadEvent = events2.data.find(
            (e) => e.type === FileEventType.DOWNLOADED,
        );
        expect(downloadEvent).toBeDefined();
        expect(downloadEvent?.action?.uuid).toBe(actionUUID);
    }, 30000);
});
