import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { FileType, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

const PATH = '/files/storage/insights/uploaders';

interface UploadersBody {
    uploaders: Record<string, unknown>[];
    other: { bytes: number; userCount: number } | null;
    totalBytes: number;
}

/** Inserts a file row directly (no upload to S3) */
const insertFile = async (options: {
    missionUuid: string;
    creator: UserEntity;
    size: number;
    deleted?: boolean;
}): Promise<void> => {
    const repository = database.getRepository(FileEntity);
    const file = await repository.save(
        repository.create({
            filename: `file_${crypto.randomUUID().slice(0, 8)}.bag`,
            mission: { uuid: options.missionUuid },
            creator: { uuid: options.creator.uuid },
            date: new Date(),
            type: FileType.BAG,
            size: options.size,
        }),
    );
    if (options.deleted) await repository.softDelete(file.uuid);
};

const get = (user: UserEntity): Promise<Response> =>
    fetch(`${DEFAULT_URL}${PATH}`, { headers: getAuthHeaders(user) });

describe('Storage By Uploader', () => {
    setupDatabaseHooks();

    test('should return 403 Forbidden to an internal non-admin user', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');
        const response = await get(user);
        expect(response.status).toBe(403);
    });

    test('should return 403 Forbidden to an external user', async () => {
        const { user } = await generateAndFetchDatabaseUser('external', 'user');
        const response = await get(user);
        expect(response.status).toBe(403);
    });

    test('should sum the stored files per uploader for an admin, without email addresses', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const suffix = String(Date.now());
        const projectUuid = await createProjectUsingPost(
            {
                name: `uploaders_${suffix}`,
                description: 'Storage by uploader test',
                requiredMetadataTypes: [],
            },
            admin,
        );
        const missionUuid = await createMissionUsingPost(
            {
                name: `uploaders_mission_${suffix}`,
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            admin,
        );

        // ten uploaders: user 0 stores 10 bytes, user 1 20 bytes, ... user 9
        // 100 bytes; the 8 largest are listed, users 0 and 1 are "other"
        const uploaders: UserEntity[] = [];
        for (let index = 0; index < 10; index++) {
            const uuid = await mockDatabaseUser(
                `uploader${String(index)}@leggedrobotics.com`,
                `Uploader ${String(index)}`,
                UserRole.USER,
            );
            const uploader = await getUserFromDatabase(uuid);
            uploaders.push(uploader);
            await insertFile({
                missionUuid,
                creator: uploader,
                size: (index + 1) * 10,
            });
        }
        // a deleted file does not count
        await insertFile({
            missionUuid,
            creator: uploaders[9] as UserEntity,
            size: 5000,
            deleted: true,
        });
        // a second file of user 9
        await insertFile({
            missionUuid,
            creator: uploaders[9] as UserEntity,
            size: 1,
        });

        const response = await get(admin);
        expect(response.status).toBe(200);
        const raw = await response.text();
        const body = JSON.parse(raw) as UploadersBody;

        expect(body.uploaders).toHaveLength(8);
        const top = body.uploaders[0] as Record<string, unknown>;
        expect(top).toMatchObject({
            uuid: uploaders[9]?.uuid,
            name: 'Uploader 9',
            bytes: 101,
            fileCount: 2,
        });
        expect(typeof top.lastUploadAt).toBe('string');
        expect(body.uploaders.map((uploader) => uploader.bytes)).toEqual([
            101, 90, 80, 70, 60, 50, 40, 30,
        ]);
        expect(body.other).toEqual({ bytes: 30, userCount: 2 });
        expect(body.totalBytes).toBe(551);

        // names only: no email addresses anywhere in the response
        for (const uploader of body.uploaders) {
            expect(uploader).not.toHaveProperty('email');
        }
        expect(raw).not.toContain('@leggedrobotics.com');
    });
});
