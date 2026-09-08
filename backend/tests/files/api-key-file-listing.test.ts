import { appVersion } from '@/app-version';
import {
    ApiKeyEntity,
    FileEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, FileType, KeyTypes } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

async function createTestFile(
    filename: string,
    missionUuid: string,
    creator: UserEntity,
): Promise<FileEntity> {
    const fileRepository = database.getRepository(FileEntity);
    return fileRepository.save(
        fileRepository.create({
            filename,
            mission: { uuid: missionUuid },
            creator: { uuid: creator.uuid },
            date: new Date(),
            type: FileType.BAG,
            size: 1024,
        }),
    );
}

async function createMissionScopedApiKey(
    missionUuid: string,
    user: UserEntity,
): Promise<string> {
    const apiKeyRepository = database.getRepository(ApiKeyEntity);
    const apiKey = apiKeyRepository.create({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        key_type: KeyTypes.ACTION,
        mission: { uuid: missionUuid },
        rights: AccessGroupRights.READ,
        user: { uuid: user.uuid },
    });
    await apiKeyRepository.save(apiKey);
    return apiKey.apikey;
}

const apiKeyHeaders = (apiKey: string): Record<string, string> => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'x-api-key': apiKey,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'kleinkram-client-version': appVersion,
});

interface FileListing {
    data: { uuid: string; filename: string }[];
}

/**
 * A mission scoped API key must only ever see files of its own mission, even
 * when the user the key belongs to has access to the other missions as well.
 */
describe('Mission scoped API keys can only list their own mission', () => {
    setupDatabaseHooks();

    let owner: UserEntity;
    let missionA: string;
    let missionB: string;
    let fileInA: FileEntity;
    let fileInB: FileEntity;
    let apiKey: string;

    beforeEach(async () => {
        // A regular (non-admin) user with access to both missions: the point of
        // the test is that the *key* is narrower than the user.
        ({ user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        ));

        const suffix = `${String(Date.now())}_${String(
            Math.floor(Math.random() * 100_000),
        )}`;

        const projectUuid = await createProjectUsingPost(
            {
                name: `api_key_scope_project_${suffix}`,
                description: 'API key scope test project',
                requiredTags: [],
                accessGroups: [
                    {
                        userUuid: owner.uuid,
                        rights: AccessGroupRights.DELETE,
                    },
                ],
            },
            owner,
        );

        missionA = await createMissionUsingPost(
            {
                name: `api_key_scope_a_${suffix}`,
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            owner,
        );
        missionB = await createMissionUsingPost(
            {
                name: `api_key_scope_b_${suffix}`,
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            owner,
        );

        fileInA = await createTestFile('in_mission_a.bag', missionA, owner);
        fileInB = await createTestFile('in_mission_b.bag', missionB, owner);

        apiKey = await createMissionScopedApiKey(missionA, owner);
    }, 60_000);

    test('an unfiltered listing only returns files of the key mission', async () => {
        const response = await fetch(`${DEFAULT_URL}/files`, {
            method: 'GET',
            headers: apiKeyHeaders(apiKey),
        });

        expect(response.status).toBe(200);
        const listing = (await response.json()) as FileListing;
        const uuids = listing.data.map((file) => file.uuid);

        expect(uuids).toContain(fileInA.uuid);
        expect(uuids).not.toContain(fileInB.uuid);
    }, 30_000);

    test('the key mission may be named explicitly', async () => {
        const response = await fetch(
            `${DEFAULT_URL}/files?missionUUID=${missionA}`,
            { method: 'GET', headers: apiKeyHeaders(apiKey) },
        );

        expect(response.status).toBe(200);
        const listing = (await response.json()) as FileListing;
        const uuids = listing.data.map((file) => file.uuid);

        expect(uuids).toContain(fileInA.uuid);
        expect(uuids).not.toContain(fileInB.uuid);
    }, 30_000);

    test('another mission cannot be requested through missionUUID', async () => {
        const response = await fetch(
            `${DEFAULT_URL}/files?missionUUID=${missionB}`,
            { method: 'GET', headers: apiKeyHeaders(apiKey) },
        );

        expect(response.status).toBe(403);
    }, 30_000);

    test('another mission cannot be requested through missionUuids', async () => {
        const response = await fetch(
            `${DEFAULT_URL}/files?missionUuids=${missionB}`,
            { method: 'GET', headers: apiKeyHeaders(apiKey) },
        );

        expect(response.status).toBe(403);
    }, 30_000);

    test('a mission pattern cannot widen the listing past the key mission', async () => {
        const response = await fetch(`${DEFAULT_URL}/files?missionPatterns=*`, {
            method: 'GET',
            headers: apiKeyHeaders(apiKey),
        });

        expect(response.status).toBe(200);
        const listing = (await response.json()) as FileListing;
        const uuids = listing.data.map((file) => file.uuid);

        expect(uuids).not.toContain(fileInB.uuid);
    }, 30_000);

    test('the same user still sees both missions with a cookie session', async () => {
        const response = await fetch(`${DEFAULT_URL}/files`, {
            method: 'GET',
            headers: getAuthHeaders(owner),
        });

        expect(response.status).toBe(200);
        const listing = (await response.json()) as FileListing;
        const uuids = listing.data.map((file) => file.uuid);

        expect(uuids).toContain(fileInA.uuid);
        expect(uuids).toContain(fileInB.uuid);
    }, 30_000);
});
