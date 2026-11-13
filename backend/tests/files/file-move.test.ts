import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { FileType, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

async function createFile(
    user: UserEntity,
    missionUuid: string,
    filename: string,
): Promise<FileEntity> {
    const fileRepository = database.getRepository(FileEntity);
    return fileRepository.save(
        fileRepository.create({
            filename,
            mission: { uuid: missionUuid },
            creator: { uuid: user.uuid },
            date: new Date(),
            type: FileType.BAG,
            size: 1024,
        }),
    );
}

async function moveFiles(
    user: UserEntity,
    fileUUIDs: string[],
    missionUUID: string,
): Promise<Response> {
    return fetch(`${DEFAULT_URL}/files`, {
        method: 'PATCH',
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        body: JSON.stringify({ fileUUIDs, missionUUID }),
    });
}

async function missionOf(fileUuid: string): Promise<string | undefined> {
    const file = await database.getRepository(FileEntity).findOneOrFail({
        where: { uuid: fileUuid },
        relations: { mission: true },
    });
    return file.mission?.uuid;
}

/**
 * `PATCH /files` moves files into another mission, also into a mission of
 * another project. The move is all-or-nothing.
 */
describe('Move Files', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let sourceProjectUuid: string;
    let sourceMissionUuid: string;
    let targetMissionUuid: string;

    beforeEach(async () => {
        const environment = await setupTestEnvironment(
            'test-file-move@leggedrobotics.com',
            'File Move User',
            UserRole.ADMIN,
        );
        user = environment.user;
        sourceProjectUuid = environment.projectUuid;
        sourceMissionUuid = environment.missionUuid;

        const targetProjectUuid = await createProjectUsingPost(
            {
                name: 'file_move_target_project',
                description: 'Target of moved files',
                requiredMetadataTypes: [],
            },
            user,
        );
        targetMissionUuid = await createMissionUsingPost(
            {
                name: 'file_move_target_mission',
                projectUUID: targetProjectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
    });

    test('should move files into a mission of another project', async () => {
        const first = await createFile(user, sourceMissionUuid, 'a.bag');
        const second = await createFile(user, sourceMissionUuid, 'b.bag');

        const response = await moveFiles(
            user,
            [first.uuid, second.uuid],
            targetMissionUuid,
        );

        expect(response.status).toBe(200);
        expect(await missionOf(first.uuid)).toBe(targetMissionUuid);
        expect(await missionOf(second.uuid)).toBe(targetMissionUuid);
    }, 30_000);

    test('should return 409 and move no file if a filename exists in the target mission', async () => {
        const free = await createFile(user, sourceMissionUuid, 'free.bag');
        const clashing = await createFile(user, sourceMissionUuid, 'taken.bag');
        await createFile(user, targetMissionUuid, 'taken.bag');

        const response = await moveFiles(
            user,
            [free.uuid, clashing.uuid],
            targetMissionUuid,
        );

        expect(response.status).toBe(409);
        const body = (await response.json()) as { message: string };
        expect(body.message).toContain('taken.bag');
        expect(await missionOf(free.uuid)).toBe(sourceMissionUuid);
        expect(await missionOf(clashing.uuid)).toBe(sourceMissionUuid);
    }, 30_000);

    test('should return 409 if two moved files share a filename', async () => {
        const otherMissionUuid = await createMissionUsingPost(
            {
                name: 'file_move_other_source',
                projectUUID: sourceProjectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
        const first = await createFile(user, sourceMissionUuid, 'same.bag');
        const second = await createFile(user, otherMissionUuid, 'same.bag');

        const response = await moveFiles(
            user,
            [first.uuid, second.uuid],
            targetMissionUuid,
        );

        expect(response.status).toBe(409);
        expect(await missionOf(first.uuid)).toBe(sourceMissionUuid);
        expect(await missionOf(second.uuid)).toBe(otherMissionUuid);
    }, 30_000);
});
