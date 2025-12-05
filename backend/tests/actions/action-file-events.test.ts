import { FileEventsDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import {
    ActionEntity,
    ActionTemplateEntity,
    FileEntity,
    MissionEntity,
} from '@kleinkram/backend-common';

import {
    AccessGroupRights,
    ActionState,
    ApikeyEntity,
    ArtifactState,
    CookieNames,
    FileEventType,
    FileState,
    FileType,
    KeyTypes,
    UserEntity,
} from '@kleinkram/backend-common';
import environment from '@kleinkram/backend-common/environment';
import * as Minio from 'minio';
import { appVersion } from '../../src/app-version';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';

import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

describe('Action File Events', () => {
    setupDatabaseHooks();

    test('should track file events triggered by an action', async () => {
        console.log('DEFAULT_URL:', DEFAULT_URL);
        // 1. Setup User
        const setup = await generateAndFetchDatabaseUser('internal', 'user');
        const user: UserEntity = setup.user;

        // 2. Create Mission
        const missionResponse = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: await createProjectUsingPost(
                    {
                        name: 'test_project',
                        description: 'desc',
                        requiredTags: [],
                        accessGroups: [],
                    },
                    user,
                ),
                tags: {},
                ignoreTags: true,
            },
            user,
        );
        const missionUuid = missionResponse;

        // Create a file
        const fileRepo = database.getRepository(FileEntity);
        const missionRepo = database.getRepository(MissionEntity);
        const mission = await missionRepo.findOneByOrFail({
            uuid: missionUuid,
        });

        const file = await fileRepo.save(
            fileRepo.create({
                filename: 'test.bag',
                mission: mission,
                // project: mission.project, // project is not a direct property of FileEntity
                creator: user,
                type: FileType.BAG,
                size: 123,
                date: new Date(),
                state: FileState.OK,
            }),
        );

        // 3. Create Action Template
        const createdTemplate = await createActionUsingPost(
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
        const templateUuid = createdTemplate;

        // 4. Manually Create Action (Mock Execution)
        const actionRepo = database.getRepository(ActionEntity);
        const templateRepo = database.getRepository(ActionTemplateEntity);
        const template = await templateRepo.findOneOrFail({
            where: { uuid: templateUuid },
        });

        const action = actionRepo.create({
            state: ActionState.PROCESSING,
            template: template,
            mission: mission,
            creator: user,
            artifacts: ArtifactState.AWAITING_ACTION,
            image: {
                sha: 'sha256:mock',
                repoDigests: [],
            },
        });
        await actionRepo.save(action);
        const actionUUID = action.uuid;

        // 5. Create Action API Key
        const apikeyRepo = database.getRepository(ApikeyEntity);
        const apikeyEntity = apikeyRepo.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: mission,
            action: action,
            rights: AccessGroupRights.WRITE,
            user: user,
        });
        await apikeyRepo.save(apikeyEntity);
        const actionKey = apikeyEntity.apikey;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const apiKey = actionKey;

        // 4. Create a File directly in DB
        // Reuse the file created earlier
        // const missionRepo = database.getRepository(MissionEntity);
        // const mission = await missionRepo.findOneByOrFail({
        //     uuid: missionUuid,
        // });

        // const fileRepo = database.getRepository(FileEntity);
        // const file = fileRepo.create({
        //     filename: 'test.bag',
        //     mission: mission,
        //     size: 1024,
        //     // bucket: 'data', // bucket does not exist on FileEntity
        //     hash: 'hash',
        //     state: FileState.OK,
        //     date: new Date(),
        //     type: FileType.BAG,
        //     creator: user,
        //     createdAt: new Date(),
        //     updatedAt: new Date(),
        // });
        // await fileRepo.save(file);

        // Upload file to MinIO to avoid 500 error during update (which tries to tag the object)
        const minioClient = new Minio.Client({
            endPoint: environment.MINIO_ENDPOINT || 'localhost',
            port: 9000,
            useSSL: false,
            accessKey: environment.MINIO_ACCESS_KEY,
            secretKey: environment.MINIO_SECRET_KEY,
        });

        const bucketName = environment.MINIO_DATA_BUCKET_NAME;
        // Bucket is created on container start
        await minioClient.putObject(
            bucketName,
            file.uuid,
            Buffer.from('dummy content'),
        );

        // 5. Download File using Action API Key
        const downloadResponse = await fetch(
            `${DEFAULT_URL}/files/download?uuid=${file.uuid}&expires=false&preview_only=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `${CookieNames.CLI_KEY}=${actionKey}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'kleinkram-client-version': appVersion,
                },
            },
        );
        expect(downloadResponse.status).toBe(200);

        // 6. Verify Download Event via Action Endpoint
        const eventsResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/file-events`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(eventsResponse.status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const events: FileEventsDto = await eventsResponse.json();

        expect(events.count).toBeGreaterThan(0);

        const downloadEvent = events.data.find(
            // eslint-disable-next-line unicorn/prevent-abbreviations
            (e) => e.type === FileEventType.DOWNLOADED,
        );
        expect(downloadEvent).toBeDefined();
        expect(downloadEvent?.action?.uuid).toBe(actionUUID);
        expect(downloadEvent?.action?.name).toBe('Test Action');
    }, 60_000);
});
