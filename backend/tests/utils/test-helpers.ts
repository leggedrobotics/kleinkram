import {
    ActionEntity,
    ActionTemplateEntity,
    ApiKeyEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import {
    AccessGroupRights,
    ActionState,
    KeyTypes,
    UserRole,
} from '@kleinkram/shared';
import { randomUUID } from 'node:crypto';
import { createMissionUsingPost, createProjectUsingPost } from './api-calls';
import {
    clearAllData,
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from './database-utilities';

export const setupDatabaseHooks = () => {
    beforeAll(async () => {
        // Wait for Loki to be ready if running against full Docker environment
        for (let index = 0; index < 20; index++) {
            try {
                const response = await fetch('http://127.0.0.1:3100/ready');
                if (response.status === 200 || response.status === 201) {
                    break;
                }
            } catch {
                // Ignore network errors while Loki is booting
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        await database.initialize();
        await clearAllData();
    }, 30_000);

    beforeEach(clearAllData);

    afterAll(async () => {
        await database.destroy();
    });
};

export const setupTestEnvironment = async (
    email = 'test@leggedrobotics.com',
    username = 'Test Env User',
    role = UserRole.ADMIN,
) => {
    const userId = await mockDatabaseUser(email, username, role);
    const user = await getUserFromDatabase(userId);
    const projectUuid = await createProjectUsingPost(
        {
            name: 'test_project',
            description: 'desc',
            requiredMetadataTypes: [],
        },
        user,
    );
    const missionUuid = await createMissionUsingPost(
        {
            name: 'test_mission',
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        user,
    );
    return { user, projectUuid, missionUuid };
};

export const createMockWorker = async (identifier = 'test-worker') => {
    const workerRepo = database.getRepository(WorkerEntity);
    const worker = workerRepo.create({
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        identifier: `${identifier}-${Date.now()}`,
        hostname: 'test-host',
        cpuCores: 8,
        cpuMemory: 16,
        gpuMemory: 0,
        cpuModel: 'Test CPU',
        storage: 1000,
        lastSeen: new Date(),
        reachable: true,
    });
    await workerRepo.save(worker);
    return worker;
};

/**
 * Creates an ACTION API key the way the queue consumer does: bound to an
 * action that is still running. The API rejects action keys whose action is
 * missing or finished, so a bare key would not authenticate.
 */
export const createActionApiKey = async (options: {
    missionUuid: string;
    userUuid: string;
    rights: AccessGroupRights;
    state?: ActionState;
}): Promise<ApiKeyEntity> => {
    const user = { uuid: options.userUuid } as UserEntity;

    const template = await database.getRepository(ActionTemplateEntity).save(
        database.getRepository(ActionTemplateEntity).create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: 'rslethz/action:test',
            name: `api-key-template-${randomUUID()}`,
            creator: user,
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: 0,
            maxRuntime: 1,
            accessRights: options.rights,
        }),
    );

    const action = await database.getRepository(ActionEntity).save(
        database.getRepository(ActionEntity).create({
            mission: { uuid: options.missionUuid },
            creator: user,
            template,
            state: options.state ?? ActionState.PROCESSING,
        }),
    );

    const apiKeyRepository = database.getRepository(ApiKeyEntity);
    return apiKeyRepository.save(
        apiKeyRepository.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: options.missionUuid },
            action,
            rights: options.rights,
            user,
        }),
    );
};
