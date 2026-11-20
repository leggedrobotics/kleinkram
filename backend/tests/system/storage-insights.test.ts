import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { FileState, FileType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

interface InsightsBody {
    totals: { bytes: number; fileCount: number; projectCount: number };
    last30Days: { bytes: number; fileCount: number };
    last90Days: { bytes: number; fileCount: number };
    monthly: { month: string; bytes: number }[];
    byProject: {
        uuid: string;
        name: string;
        bytes: number;
        missionCount: number;
    }[];
    otherProjects: { bytes: number; projectCount: number } | null;
    byType: { type: string; bytes: number; fileCount: number }[];
    largestMissions: { missionUuid: string; bytes: number }[];
}

/**
 * Inserts a file row directly (no upload to S3). `createdAgo` and
 * `deletedAgo` are PostgreSQL intervals relative to the database's NOW(), so
 * the test does not depend on the runner's time zone.
 */
const insertFile = async (options: {
    missionUuid: string;
    creator: UserEntity;
    type: FileType;
    size: number;
    state?: FileState;
    createdAgo?: string;
    deletedAgo?: string;
}): Promise<void> => {
    const repository = database.getRepository(FileEntity);
    const file = await repository.save(
        repository.create({
            filename: `file_${crypto.randomUUID().slice(0, 8)}.${options.type.toLowerCase()}`,
            mission: { uuid: options.missionUuid },
            creator: { uuid: options.creator.uuid },
            date: new Date(),
            type: options.type,
            size: options.size,
            state: options.state ?? FileState.OK,
        }),
    );
    await database.query(
        `UPDATE file_entity
         SET "createdAt" = NOW() - $2::interval,
             "deletedAt" = CASE WHEN $3::text IS NULL THEN NULL
                                ELSE NOW() - $3::interval END
         WHERE uuid = $1`,
        [
            file.uuid,
            options.createdAgo ?? '0 seconds',
            options.deletedAgo ?? null,
        ],
    );
};

describe('Storage Insights', () => {
    setupDatabaseHooks();

    test('should aggregate the stored files by month, project, type and mission', async () => {
        const { user } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const suffix = String(Date.now());

        const projectA = await createProjectUsingPost(
            {
                name: `insights_a_${suffix}`,
                description: 'Storage insights test',
                requiredMetadataTypes: [],
            },
            user,
        );
        const projectB = await createProjectUsingPost(
            {
                name: `insights_b_${suffix}`,
                description: 'Storage insights test',
                requiredMetadataTypes: [],
            },
            user,
        );
        const missionA = await createMissionUsingPost(
            {
                name: `mission_a_${suffix}`,
                projectUUID: projectA,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
        const missionB = await createMissionUsingPost(
            {
                name: `mission_b_${suffix}`,
                projectUUID: projectB,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );

        await insertFile({
            missionUuid: missionA,
            creator: user,
            type: FileType.BAG,
            size: 100,
        });
        await insertFile({
            missionUuid: missionA,
            creator: user,
            type: FileType.MCAP,
            size: 200,
            createdAgo: '60 days',
        });
        await insertFile({
            missionUuid: missionB,
            creator: user,
            type: FileType.YAML,
            size: 50,
        });
        // deleted a minute ago: not stored now, but still at the end of
        // last month
        await insertFile({
            missionUuid: missionA,
            creator: user,
            type: FileType.BAG,
            size: 1000,
            createdAgo: '60 days',
            deletedAgo: '1 minute',
        });

        const response = await fetch(`${DEFAULT_URL}/files/storage/insights`, {
            headers: getAuthHeaders(user),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as InsightsBody;

        expect(body.totals).toEqual({
            bytes: 350,
            fileCount: 3,
            projectCount: 2,
        });
        expect(body.last30Days).toEqual({ bytes: 150, fileCount: 2 });
        expect(body.last90Days).toEqual({ bytes: 350, fileCount: 3 });

        expect(body.monthly).toHaveLength(12);
        // now: the existing files only
        expect(body.monthly[11]?.bytes).toBe(350);
        // end of last month: the two files from 60 days ago, including the
        // one deleted since
        expect(body.monthly[10]?.bytes).toBe(1200);

        expect(
            body.byProject.map(({ uuid, bytes, missionCount }) => ({
                uuid,
                bytes,
                missionCount,
            })),
        ).toEqual([
            { uuid: projectA, bytes: 300, missionCount: 1 },
            { uuid: projectB, bytes: 50, missionCount: 1 },
        ]);
        expect(body.otherProjects).toBeNull();

        expect(
            body.byType.map(({ type, bytes, fileCount }) => ({
                type,
                bytes,
                fileCount,
            })),
        ).toEqual([
            { type: FileType.MCAP, bytes: 200, fileCount: 1 },
            { type: FileType.BAG, bytes: 100, fileCount: 1 },
            { type: FileType.YAML, bytes: 50, fileCount: 1 },
        ]);

        expect(
            body.largestMissions.map(({ missionUuid, bytes }) => ({
                missionUuid,
                bytes,
            })),
        ).toEqual([
            { missionUuid: missionA, bytes: 300 },
            { missionUuid: missionB, bytes: 50 },
        ]);
    });

    test('should not count uploads that have not finished or were cancelled', async () => {
        const { user } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const suffix = String(Date.now());
        const project = await createProjectUsingPost(
            {
                name: `insights_states_${suffix}`,
                description: 'Storage insights test',
                requiredMetadataTypes: [],
            },
            user,
        );
        const mission = await createMissionUsingPost(
            {
                name: `mission_states_${suffix}`,
                projectUUID: project,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
        const file = {
            missionUuid: mission,
            creator: user,
            type: FileType.BAG,
        };
        await insertFile({ ...file, size: 100 });
        await insertFile({ ...file, size: 50, state: FileState.ERROR });
        // rows reserved for an upload hold no data yet
        await insertFile({ ...file, size: 0, state: FileState.UPLOADING });
        await insertFile({ ...file, size: 0, state: FileState.CANCELED });

        const response = await fetch(`${DEFAULT_URL}/files/storage/insights`, {
            headers: getAuthHeaders(user),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as InsightsBody;
        expect(body.totals).toEqual({
            bytes: 150,
            fileCount: 2,
            projectCount: 1,
        });
        expect(body.last30Days.fileCount).toBe(2);
        expect(body.byType).toEqual([
            expect.objectContaining({
                type: FileType.BAG,
                bytes: 150,
                fileCount: 2,
            }),
        ]);

        const uploaders = await fetch(
            `${DEFAULT_URL}/files/storage/insights/uploaders`,
            { headers: getAuthHeaders(user) },
        );
        const { uploaders: rows } = (await uploaders.json()) as {
            uploaders: { uuid: string; fileCount: number }[];
        };
        expect(rows.find((row) => row.uuid === user.uuid)?.fileCount).toBe(2);
    });
});
