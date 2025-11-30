import { FileEventsDto } from '@common/api/types/file/file-event.dto';
import ActionEntity from '@common/entities/action/action.entity';
import FileEntity from '@common/entities/file/file.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import environment from '@common/environment';
import {
    AccessGroupRights,
    CookieNames,
    FileEventType,
    FileState,
    FileType,
    UserRole,
} from '@common/frontend_shared/enum';
import * as Minio from 'minio';
import { appVersion } from '../../src/app-version';
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
                cpuMemory: 2,
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
                'kleinkram-client-version': appVersion,
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const { actionUUID } = await submitResponse.json();

        // 3. Get Action API Key
        // Wait for action key to be generated (async worker)
        let action = await database.getRepository(ActionEntity).findOneOrFail({
            where: { uuid: actionUUID },
            relations: ['key'],
        });

        let attempts = 0;
        while (!action.key && attempts < 20) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            action = await database.getRepository(ActionEntity).findOneOrFail({
                where: { uuid: actionUUID },
                relations: ['key'],
            });
            attempts++;
        }
        const actionKey = action.key?.apikey as string;

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
            filename: 'test.bag',
            mission: mission,
            size: 1024,
            // bucket: 'data', // bucket does not exist on FileEntity
            hash: 'hash',
            // uploaded: true, // uploaded does not exist on FileEntity? Let's check.
            // It seems I copied properties from somewhere else or guessed them.
            // Let's check FileEntity again.
            // It has state.
            state: FileState.OK,
            date: new Date(),
            type: FileType.BAG,
            creator: user,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await fileRepo.save(file);

        // Upload file to MinIO to avoid 500 error during update (which tries to tag the object)
        const minioClient = new Minio.Client({
            endPoint: environment.MINIO_ENDPOINT || 'localhost',
            port: 9000,
            useSSL: false,
            accessKey: environment.MINIO_ACCESS_KEY,
            secretKey: environment.MINIO_SECRET_KEY,
        });

        const bucketName = environment.MINIO_DATA_BUCKET_NAME;
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
        }
        await minioClient.putObject(
            bucketName,
            file.uuid,
            Buffer.from('dummy content'),
        );

        // 5. Update File using Action API Key
        const updateResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `${CookieNames.CLI_KEY}=${apiKey}`,
                    'kleinkram-client-version': appVersion,
                },
                body: JSON.stringify({
                    uuid: file.uuid,
                    filename: 'updated.bag',
                    date: new Date(),
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
                    'kleinkram-client-version': appVersion,
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
        expect(event?.details['oldFilename']).toBe('test.bag');
        expect(event?.details['newFilename']).toBe('updated.bag');

        // 7. Download File using Action API Key
        const downloadResponse = await fetch(
            `${DEFAULT_URL}/files/download?uuid=${file.uuid}&expires=false&preview_only=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `${CookieNames.CLI_KEY}=${actionKey}`,
                    'kleinkram-client-version': appVersion,
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
                    'kleinkram-client-version': appVersion,
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
