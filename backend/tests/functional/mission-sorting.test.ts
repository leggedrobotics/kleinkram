import {
    FileEntity,
    MetadataEntity,
    UserEntity,
} from '@kleinkram/backend-common';
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

interface Fixture {
    user: UserEntity;
    projectUuid: string;
    /** no files, no metadata: both required metadata types missing */
    empty: string;
    /** two small files, one of the two required metadata types set */
    partial: string;
    /** one big file, both required metadata types set */
    complete: string;
}

const setup = async (): Promise<Fixture> => {
    const userUuid = await mockDatabaseUser(
        'mission-sorting@kleinkram.dev',
        'Mission Sorting User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);

    const requiredTypeUuids = [
        await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'required_a' },
            user,
        ),
        await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'required_b' },
            user,
        ),
    ];

    const projectUuid = await createProjectUsingPost(
        {
            name: 'mission_sorting_project',
            description: 'missions to sort',
            requiredMetadataTypes: requiredTypeUuids,
        },
        user,
    );

    const [empty, partial, complete] = [
        await createMissionUsingPost(
            {
                name: 'a_empty',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        ),
        await createMissionUsingPost(
            {
                name: 'b_partial',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        ),
        await createMissionUsingPost(
            {
                name: 'c_complete',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        ),
    ];

    const fileRepository = database.getRepository(FileEntity);
    for (const [missionUuid, filename, size] of [
        [partial, 'small_1.bag', 100],
        [partial, 'small_2.bag', 100],
        [complete, 'big.bag', 1000],
    ] as const) {
        await fileRepository.save(
            fileRepository.create({
                filename,
                mission: { uuid: missionUuid },
                creator: { uuid: user.uuid },
                date: new Date(),
                type: FileType.BAG,
                size,
            }),
        );
    }

    const metadataRepository = database.getRepository(MetadataEntity);
    for (const [missionUuid, metadataTypeUuid] of [
        [partial, requiredTypeUuids[0]],
        [complete, requiredTypeUuids[0]],
        [complete, requiredTypeUuids[1]],
    ] as const) {
        await metadataRepository.save(
            metadataRepository.create({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                value_string: 'value',
                mission: { uuid: missionUuid },
                metadataType: { uuid: metadataTypeUuid },
                creator: { uuid: user.uuid },
            }),
        );
    }

    return { user, projectUuid, empty, partial, complete };
};

const fetchSorted = async (
    { user, projectUuid }: Fixture,
    sortBy: string,
    sortDirection: 'ASC' | 'DESC',
    minimal = false,
): Promise<string[]> => {
    const response = await fetch(
        `${DEFAULT_URL}/missions?take=10&skip=0&projectUuid=${projectUuid}&sortBy=${sortBy}&sortDirection=${sortDirection}&minimal=${String(minimal)}`,
        { method: 'GET', headers: getAuthHeaders(user) },
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { uuid: string }[] };
    return json.data.map((mission) => mission.uuid);
};

/**
 * Every column of the mission table in the frontend can be sorted by, so the
 * `/missions` endpoint has to sort by each of them.
 */
describe('Mission sorting', () => {
    setupDatabaseHooks();

    test('sorts missions by file count (sortBy=filesCount)', async () => {
        const fixture = await setup();
        const { empty, partial, complete } = fixture;

        expect(await fetchSorted(fixture, 'filesCount', 'ASC')).toEqual([
            empty,
            complete,
            partial,
        ]);
        expect(await fetchSorted(fixture, 'filesCount', 'DESC')).toEqual([
            partial,
            complete,
            empty,
        ]);
    });

    test('sorts missions by size (sortBy=size)', async () => {
        const fixture = await setup();
        const { empty, partial, complete } = fixture;

        expect(await fetchSorted(fixture, 'size', 'ASC')).toEqual([
            empty,
            partial,
            complete,
        ]);
        expect(await fetchSorted(fixture, 'size', 'DESC')).toEqual([
            complete,
            partial,
            empty,
        ]);
        // the minimal projection keeps the order of the sorted ids as well
        expect(await fetchSorted(fixture, 'size', 'DESC', true)).toEqual([
            complete,
            partial,
            empty,
        ]);
    });

    test('sorts missions by missing required metadata (sortBy=missingMetadata)', async () => {
        const fixture = await setup();
        const { empty, partial, complete } = fixture;

        expect(await fetchSorted(fixture, 'missingMetadata', 'ASC')).toEqual([
            complete,
            partial,
            empty,
        ]);
        expect(await fetchSorted(fixture, 'missingMetadata', 'DESC')).toEqual([
            empty,
            partial,
            complete,
        ]);
    });

    test('sorts missions by creator (sortBy=creator)', async () => {
        const fixture = await setup();
        const { empty, partial, complete } = fixture;

        // one creator only, so the uuid tie-breaker decides the order
        // eslint-disable-next-line unicorn/no-array-sort
        const expected = [empty, partial, complete].sort();
        expect(await fetchSorted(fixture, 'creator', 'ASC')).toEqual(expected);
        expect(await fetchSorted(fixture, 'creator', 'DESC')).toEqual(expected);
    });
});
