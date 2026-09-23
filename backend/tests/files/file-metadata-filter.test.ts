import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { DataType, FileType, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMetadataTypeUsingPost,
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

interface Listing {
    data: { name?: string; filename?: string }[];
}

const createTestFile = async (
    filename: string,
    missionUuid: string,
    creator: UserEntity,
): Promise<FileEntity> => {
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
};

const list = async (
    user: UserEntity,
    path: string,
    parameters: Record<string, string>,
): Promise<string[]> => {
    const query = new URLSearchParams(parameters).toString();
    const response = await fetch(`${DEFAULT_URL}/${path}?${query}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    const listing = (await response.json()) as Listing;
    return listing.data.map((entry) => entry.filename ?? entry.name ?? '');
};

/**
 * Files and missions can be filtered by the metadata of their mission, either
 * by metadata type uuid (`metadataByTypeUuid`, deprecated alias `tags`) or by
 * metadata type name (`metadata`).
 */
describe('Filtering by mission metadata', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let metadataTypeUuid: string;

    beforeEach(async () => {
        user = await getUserFromDatabase(
            await mockDatabaseUser(
                'metadata-filter@kleinkram.dev',
                'Metadata Filter User',
                UserRole.ADMIN,
            ),
        );

        metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'robot' },
            user,
        );

        const projectUuid = await createProjectUsingPost(
            { name: 'metadata_filter_project', description: 'desc' },
            user,
        );

        for (const robot of ['anymal', 'spot']) {
            const missionUuid = await createMissionUsingPost(
                {
                    name: `mission_${robot}`,
                    projectUUID: projectUuid,
                    metadata: { [metadataTypeUuid]: robot },
                },
                user,
            );
            await createTestFile(`file_${robot}.bag`, missionUuid, user);
        }
    });

    test('files can be filtered by metadata type uuid', async () => {
        expect(
            await list(user, 'files', {
                metadataByTypeUuid: JSON.stringify({
                    [metadataTypeUuid]: 'anymal',
                }),
            }),
        ).toEqual(['file_anymal.bag']);
    });

    test('files can be filtered with the deprecated tags alias', async () => {
        expect(
            await list(user, 'files', {
                tags: JSON.stringify({ [metadataTypeUuid]: 'spot' }),
            }),
        ).toEqual(['file_spot.bag']);
    });

    test('metadataByTypeUuid wins over the deprecated tags alias', async () => {
        expect(
            await list(user, 'files', {
                metadataByTypeUuid: JSON.stringify({
                    [metadataTypeUuid]: 'anymal',
                }),
                tags: JSON.stringify({ [metadataTypeUuid]: 'spot' }),
            }),
        ).toEqual(['file_anymal.bag']);
    });

    test('files can be filtered by metadata type name', async () => {
        expect(
            await list(user, 'files', { 'metadata[robot]': 'spot' }),
        ).toEqual(['file_spot.bag']);
    });

    test('missions can be filtered by metadata type name', async () => {
        expect(
            await list(user, 'missions', { 'metadata[robot]': 'anymal' }),
        ).toEqual(['mission_anymal']);
    });
});
