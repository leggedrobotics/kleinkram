import { appVersion } from '@/app-version';
import {
    FileEntity,
    IngestionJobEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, FileState, FileType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { createActionApiKey, setupDatabaseHooks } from '../utils/test-helpers';

const ORIGINAL_HASH = 'b3JpZ2luYWwtaGFzaA==';

const uniqueSuffix = (): string =>
    `${String(Date.now())}_${String(Math.floor(Math.random() * 100_000))}`;

async function createProject(
    creator: UserEntity,
    accessGroups: { userUuid: string; rights: AccessGroupRights }[],
): Promise<string> {
    return createProjectUsingPost(
        {
            name: `confirm_access_project_${uniqueSuffix()}`,
            description: 'Upload confirm access test project',
            requiredMetadataTypes: [],
            accessGroups,
        },
        creator,
    );
}

async function createMission(
    projectUuid: string,
    creator: UserEntity,
): Promise<string> {
    return createMissionUsingPost(
        {
            name: `confirm_access_mission_${uniqueSuffix()}`,
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
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

const postConfirm = (
    headers: Record<string, string>,
    uuid: string,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/files/upload/confirm`, {
        method: 'POST',
        headers: {
            ...headers,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid, md5: 'YXR0YWNrZXItaGFzaA==' }),
    });

const confirmAsUser = (user: UserEntity, uuid: string): Promise<Response> =>
    postConfirm(getAuthHeaders(user), uuid);

const confirmWithApiKey = (apiKey: string, uuid: string): Promise<Response> =>
    postConfirm(
        {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'x-api-key': apiKey,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'kleinkram-client-version': appVersion,
        },
        uuid,
    );

const ingestionJobExists = (fileUuid: string): Promise<boolean> =>
    database
        .getRepository(IngestionJobEntity)
        .existsBy({ identifier: fileUuid });

/**
 * The request got past the guard and reached the handler. The handler creates
 * the ingestion job before it looks the file up in storage. The tests never
 * upload an object, so the request itself still fails after that.
 */
async function expectReachedHandler(
    response: Response,
    fileUuid: string,
): Promise<void> {
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(await ingestionJobExists(fileUuid)).toBe(true);
}

async function expectFileUnchanged(fileUuid: string): Promise<void> {
    const file = await database
        .getRepository(FileEntity)
        .findOneOrFail({ where: { uuid: fileUuid } });
    expect(file.hash).toBe(ORIGINAL_HASH);
    expect(file.state).toBe(FileState.UPLOADING);
    expect(await ingestionJobExists(fileUuid)).toBe(false);
}

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
        'should reject a user %s confirming a foreign upload',
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

            const projectUuid = await createProject(
                owner,
                rights === undefined
                    ? []
                    : [{ userUuid: attacker.uuid, rights }],
            );
            const missionUuid = await createMission(projectUuid, owner);
            const file = await createUploadingFile(missionUuid, owner);

            const response = await confirmAsUser(attacker, file.uuid);
            expect(response.status).toBe(403);
            await expectFileUnchanged(file.uuid);
        },
        30_000,
    );

    test('should let a user with CREATE rights confirm an upload', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: uploader } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const projectUuid = await createProject(owner, [
            { userUuid: uploader.uuid, rights: AccessGroupRights.CREATE },
        ]);
        const missionUuid = await createMission(projectUuid, owner);
        const file = await createUploadingFile(missionUuid, owner);

        await expectReachedHandler(
            await confirmAsUser(uploader, file.uuid),
            file.uuid,
        );
    }, 30_000);

    describe('with an API key', () => {
        let owner: UserEntity;
        let missionA: string;
        let missionB: string;

        beforeEach(async () => {
            ({ user: owner } = await generateAndFetchDatabaseUser(
                'internal',
                'user',
            ));
            const projectUuid = await createProject(owner, [
                { userUuid: owner.uuid, rights: AccessGroupRights.DELETE },
            ]);
            missionA = await createMission(projectUuid, owner);
            missionB = await createMission(projectUuid, owner);
        }, 60_000);

        test('should reject a key of another mission in the same project', async () => {
            const file = await createUploadingFile(missionB, owner);
            const { apikey } = await createActionApiKey({
                missionUuid: missionA,
                userUuid: owner.uuid,
                rights: AccessGroupRights.DELETE,
            });

            const response = await confirmWithApiKey(apikey, file.uuid);
            expect(response.status).toBe(403);
            await expectFileUnchanged(file.uuid);
        }, 30_000);

        test('should reject a key of the mission with only READ rights', async () => {
            const file = await createUploadingFile(missionA, owner);
            const { apikey } = await createActionApiKey({
                missionUuid: missionA,
                userUuid: owner.uuid,
                rights: AccessGroupRights.READ,
            });

            const response = await confirmWithApiKey(apikey, file.uuid);
            expect(response.status).toBe(403);
            await expectFileUnchanged(file.uuid);
        }, 30_000);

        test('should let a key of the mission with CREATE rights confirm an upload', async () => {
            const file = await createUploadingFile(missionA, owner);
            const { apikey } = await createActionApiKey({
                missionUuid: missionA,
                userUuid: owner.uuid,
                rights: AccessGroupRights.CREATE,
            });

            await expectReachedHandler(
                await confirmWithApiKey(apikey, file.uuid),
                file.uuid,
            );
        }, 30_000);
    });
});
