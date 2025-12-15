import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { UserRole } from '@kleinkram/shared';
import { createMissionUsingPost, createProjectUsingPost } from './api-calls';
import {
    clearAllData,
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from './database-utilities';

export const setupDatabaseHooks = () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    }, 30_000);

    beforeEach(clearAllData);

    afterAll(async () => {
        await database.destroy();
    });
};

export const setupTestEnvironment = async (
    email = 'test@kleinkram.dev',
    username = 'Test Env User',
    role = UserRole.ADMIN,
) => {
    const userId = await mockDatabaseUser(email, username, role);
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
