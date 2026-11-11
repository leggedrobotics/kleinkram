import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { FileEntity, TopicEntity, UserEntity } from '@kleinkram/backend-common';
import environment from '@kleinkram/backend-common/environment';
import { FileState, FileType, UserRole } from '@kleinkram/shared';
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
            state: FileState.OK,
        }),
    );
}

const s3Client = new S3Client({
    endpoint: `http://${environment.S3_ENDPOINT || 'localhost'}:9000`,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials: {
        accessKeyId: environment.S3_ACCESS_KEY,
        secretAccessKey: environment.S3_SECRET_KEY,
    },
});

async function sendJson(
    user: UserEntity,
    method: string,
    path: string,
    body: unknown,
): Promise<Response> {
    return fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        body: JSON.stringify(body),
    });
}

async function moveFiles(
    user: UserEntity,
    fileUUIDs: string[],
    missionUUID: string,
    renames?: Record<string, string>,
): Promise<Response> {
    return sendJson(user, 'PATCH', '/files', {
        fileUUIDs,
        missionUUID,
        ...(renames ? { renames } : {}),
    });
}

async function copyFiles(
    user: UserEntity,
    fileUUIDs: string[],
    missionUUID: string,
    renames?: Record<string, string>,
): Promise<Response> {
    return sendJson(user, 'POST', '/files/copy', {
        fileUUIDs,
        missionUUID,
        ...(renames ? { renames } : {}),
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

    test('should move a file under a new name to resolve a conflict', async () => {
        const clashing = await createFile(user, sourceMissionUuid, 'taken.bag');
        await createFile(user, targetMissionUuid, 'taken.bag');

        const response = await moveFiles(
            user,
            [clashing.uuid],
            targetMissionUuid,
            {
                [clashing.uuid]: 'taken_1.bag',
            },
        );

        expect(response.status).toBe(200);
        const moved = await database.getRepository(FileEntity).findOneOrFail({
            where: { uuid: clashing.uuid },
            relations: { mission: true },
        });
        expect(moved.mission?.uuid).toBe(targetMissionUuid);
        expect(moved.filename).toBe('taken_1.bag');
    }, 30_000);

    test('should return 400 if a rename changes the extension', async () => {
        const file = await createFile(user, sourceMissionUuid, 'a.bag');

        const response = await moveFiles(user, [file.uuid], targetMissionUuid, {
            [file.uuid]: 'a.mcap',
        });

        expect(response.status).toBe(400);
        expect(await missionOf(file.uuid)).toBe(sourceMissionUuid);
    }, 30_000);

    test('should copy a file with its data and topics and keep the original', async () => {
        const original = await createFile(
            user,
            sourceMissionUuid,
            'copy_me.bag',
        );
        await database.getRepository(TopicEntity).save({
            name: '/imu',
            type: 'sensor_msgs/Imu',
            nrMessages: 10n,
            messageEncoding: 'ros1',
            frequency: 100,
            file: { uuid: original.uuid },
        });
        await s3Client.send(
            new PutObjectCommand({
                Bucket: environment.S3_DATA_BUCKET_NAME,
                Key: original.uuid,
                Body: Buffer.from('copy me'),
            }),
        );

        const response = await copyFiles(
            user,
            [original.uuid],
            targetMissionUuid,
        );

        expect(response.status).toBe(201);
        const { fileUUIDs } = (await response.json()) as {
            fileUUIDs: string[];
        };
        expect(fileUUIDs).toHaveLength(1);
        const copyUuid = fileUUIDs[0] ?? '';

        expect(await missionOf(original.uuid)).toBe(sourceMissionUuid);
        const copy = await database.getRepository(FileEntity).findOneOrFail({
            where: { uuid: copyUuid },
            relations: { mission: true, topics: true },
        });
        expect(copy.mission?.uuid).toBe(targetMissionUuid);
        expect(copy.filename).toBe('copy_me.bag');
        expect(copy.state).toBe(FileState.OK);
        expect(copy.topics?.map((topic) => topic.name)).toEqual(['/imu']);

        const object = await s3Client.send(
            new GetObjectCommand({
                Bucket: environment.S3_DATA_BUCKET_NAME,
                Key: copyUuid,
            }),
        );
        expect(await object.Body?.transformToString()).toBe('copy me');
    }, 30_000);

    test('should return 409 when copying into the same mission without a rename', async () => {
        const original = await createFile(user, sourceMissionUuid, 'twin.bag');

        const response = await copyFiles(
            user,
            [original.uuid],
            sourceMissionUuid,
        );

        expect(response.status).toBe(409);
    }, 30_000);

    test('should list which filenames already exist in a mission', async () => {
        await createFile(user, targetMissionUuid, 'exists.bag');

        const response = await sendJson(user, 'POST', '/files/existingNames', {
            missionUUID: targetMissionUuid,
            filenames: ['exists.bag', 'free.bag'],
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ filenames: ['exists.bag'] });
    }, 30_000);

    test('should return 409 when the update endpoint moves a file onto a taken name', async () => {
        const file = await createFile(user, sourceMissionUuid, 'taken.bag');
        await createFile(user, targetMissionUuid, 'taken.bag');

        const response = await sendJson(user, 'PUT', `/files/${file.uuid}`, {
            uuid: file.uuid,
            filename: file.filename,
            date: file.date,
            missionUuid: targetMissionUuid,
            categories: [],
        });

        expect(response.status).toBe(409);
        expect(await missionOf(file.uuid)).toBe(sourceMissionUuid);
    }, 30_000);
});
