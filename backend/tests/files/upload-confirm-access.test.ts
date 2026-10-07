import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, FileState, FileType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

const ORIGINAL_HASH = 'b3JpZ2luYWwtaGFzaA==';

async function setupMissionWithAccess(
    creator: UserEntity,
    accessUser: UserEntity,
    rights: AccessGroupRights,
): Promise<string> {
    const suffix = `${String(Date.now())}_${String(
        Math.floor(Math.random() * 100_000),
    )}`;

    const projectUuid = await createProjectUsingPost(
        {
            name: `confirm_access_project_${suffix}`,
            description: 'Upload confirm access test project',
            requiredTags: [],
            accessGroups: [{ userUuid: accessUser.uuid, rights }],
        },
        creator,
    );

    return createMissionUsingPost(
        {
            name: `confirm_access_mission_${suffix}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        creator,
    );
}

async function createUploadingFile(
    missionUuid: string,
    creator: UserEntity,
): Promise<FileEntity> {
    const fileRepository = database.getRepository(FileEntity);
    return fileRepository.save(
        fileRepository.create({
            filename: 'victim.bag',
            mission: { uuid: missionUuid },
            creator: { uuid: creator.uuid },
            date: new Date(),
            type: FileType.BAG,
            size: 1024,
            state: FileState.UPLOADING,
            hash: ORIGINAL_HASH,
        }),
    );
}

const confirmUpload = (user: UserEntity, uuid: string): Promise<Response> =>
    fetch(`${DEFAULT_URL}/files/upload/confirm`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid, md5: 'YXR0YWNrZXItaGFzaA==' }),
    });

/**
 * `POST /files/upload/confirm` marks an upload as complete, stores the
 * caller-supplied hash and fires UPLOAD triggers. Only callers who may upload
 * into the file's mission are allowed to do that.
 */
describe('POST /files/upload/confirm authorizes against the file', () => {
    setupDatabaseHooks();

    test.each([
        ['without any rights', undefined],
        ['with only READ rights', AccessGroupRights.READ],
    ])(
        'a user %s cannot confirm a foreign upload',
        async (_label, rights) => {
            const { user: owner } = await generateAndFetchDatabaseUser(
                'internal',
                'admin',
            );
            // External users do not get default rights through an
            // affiliation group, so they only hold what the test grants.
            const { user: attacker } = await generateAndFetchDatabaseUser(
                'external',
                'user',
            );

            const missionUuid = await setupMissionWithAccess(
                owner,
                rights === undefined ? owner : attacker,
                rights ?? AccessGroupRights.DELETE,
            );
            const file = await createUploadingFile(missionUuid, owner);

            const response = await confirmUpload(attacker, file.uuid);
            expect(response.status).toBe(403);

            const unchanged = await database
                .getRepository(FileEntity)
                .findOneOrFail({ where: { uuid: file.uuid } });
            expect(unchanged.hash).toBe(ORIGINAL_HASH);
            expect(unchanged.state).toBe(FileState.UPLOADING);
        },
        30_000,
    );

    test('a user with CREATE rights passes the guard', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: uploader } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const missionUuid = await setupMissionWithAccess(
            owner,
            uploader,
            AccessGroupRights.CREATE,
        );
        const file = await createUploadingFile(missionUuid, owner);

        // No object exists in storage, so the handler still fails, but only
        // after the guard let the request through.
        const response = await confirmUpload(uploader, file.uuid);
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
    }, 30_000);
});
