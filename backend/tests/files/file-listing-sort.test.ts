import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { FileType, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
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

interface FileListing {
    data: { uuid: string; filename: string }[];
    count: number;
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

const listFilenames = async (
    user: UserEntity,
    parameters: string,
): Promise<string[]> => {
    const response = await fetch(`${DEFAULT_URL}/files?${parameters}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    const listing = (await response.json()) as FileListing;
    return listing.data.map((file) => file.filename);
};

/**
 * The data table sorts by the creator, the project and the mission name. Those
 * live on joined relations, not on the file itself, which the id query of
 * `findMany` groups by - so they need their own handling to be sortable at all.
 */
describe('File listing sorted by a joined relation', () => {
    setupDatabaseHooks();

    let admin: UserEntity;
    let otherCreator: UserEntity;

    beforeEach(async () => {
        admin = await getUserFromDatabase(
            await mockDatabaseUser(
                'sort-admin@leggedrobotics.com',
                'aaa_creator',
                UserRole.ADMIN,
            ),
        );
        otherCreator = await getUserFromDatabase(
            await mockDatabaseUser(
                'sort-other@leggedrobotics.com',
                'zzz_creator',
                UserRole.ADMIN,
            ),
        );

        // one file per project/mission/creator combination, named so that the
        // expected order is obvious from the filename alone
        const firstProject = await createProjectUsingPost(
            {
                name: 'aaa_project',
                description: 'sorting test project',
                requiredMetadataTypes: [],
            },
            admin,
        );
        const secondProject = await createProjectUsingPost(
            {
                name: 'zzz_project',
                description: 'sorting test project',
                requiredMetadataTypes: [],
            },
            admin,
        );
        const firstMission = await createMissionUsingPost(
            {
                name: 'aaa_mission',
                projectUUID: firstProject,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            admin,
        );
        const secondMission = await createMissionUsingPost(
            {
                name: 'zzz_mission',
                projectUUID: secondProject,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            admin,
        );

        await createTestFile('first.bag', firstMission, admin);
        await createTestFile('second.bag', secondMission, otherCreator);
    }, 60_000);

    test.each(['creator.name', 'mission.name', 'project.name'])(
        'sorts by %s in both directions',
        async (sortKey) => {
            const ascending = await listFilenames(
                admin,
                `sort=${sortKey}&sortDirection=ASC`,
            );
            expect(ascending).toEqual(['first.bag', 'second.bag']);

            const descending = await listFilenames(
                admin,
                `sort=${sortKey}&sortDirection=DESC`,
            );
            expect(descending).toEqual(['second.bag', 'first.bag']);
        },
        30_000,
    );

    test('sorting by a joined relation does not duplicate or drop files', async () => {
        const response = await fetch(
            `${DEFAULT_URL}/files?sort=creator.name&sortDirection=ASC`,
            { method: 'GET', headers: getAuthHeaders(admin) },
        );

        expect(response.status).toBe(200);
        const listing = (await response.json()) as FileListing;
        expect(listing.count).toBe(2);
        expect(listing.data).toHaveLength(2);
    }, 30_000);

    test('an unknown sort key is still rejected', async () => {
        const response = await fetch(
            `${DEFAULT_URL}/files?sort=creator.email`,
            { method: 'GET', headers: getAuthHeaders(admin) },
        );

        expect(response.status).toBe(405);
    }, 30_000);
});
