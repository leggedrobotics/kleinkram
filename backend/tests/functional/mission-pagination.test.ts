import { DEFAULT_URL } from '../auth/utilities';
import { createMissionUsingPost, getAuthHeaders } from '../utils/api-calls';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

interface MissionListResponse {
    data: { uuid: string; name: string }[];
    count: number;
    take: number;
    skip: number;
}

const TOTAL_MISSIONS = 7;
const PAGE_SIZE = 3;

const fetchPage = async (
    user: Parameters<typeof getAuthHeaders>[0],
    parameters: string,
): Promise<MissionListResponse> => {
    const response = await fetch(`${DEFAULT_URL}/missions?${parameters}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as MissionListResponse;
};

describe('Mission list pagination', () => {
    setupDatabaseHooks();

    test('honours take/skip and returns disjoint pages', async () => {
        const { user, projectUuid } = await setupTestEnvironment(
            'mission-pagination@kleinkram.dev',
            'Mission Pagination User',
        );

        // setupTestEnvironment already created one mission ('test_mission')
        for (let index = 1; index < TOTAL_MISSIONS; index++) {
            await createMissionUsingPost(
                {
                    name: `pagination_mission_${String(index).padStart(2, '0')}`,
                    projectUUID: projectUuid,
                    tags: {},
                    ignoreTags: true,
                },
                user,
            );
        }

        const sort = 'sortBy=name&sortOrder=asc';

        const page1 = await fetchPage(
            user,
            `take=${String(PAGE_SIZE)}&skip=0&${sort}`,
        );
        expect(page1.count).toBe(TOTAL_MISSIONS);
        expect(page1.data).toHaveLength(PAGE_SIZE);

        const page2 = await fetchPage(
            user,
            `take=${String(PAGE_SIZE)}&skip=${String(PAGE_SIZE)}&${sort}`,
        );
        expect(page2.count).toBe(TOTAL_MISSIONS);
        expect(page2.data).toHaveLength(PAGE_SIZE);

        const page1Uuids = page1.data.map((mission) => mission.uuid);
        const page2Uuids = new Set(page2.data.map((mission) => mission.uuid));
        expect(page1Uuids).not.toEqual([...page2Uuids]);
        expect(page1Uuids.filter((uuid) => page2Uuids.has(uuid))).toHaveLength(
            0,
        );

        // the last page only holds the remainder
        const page3 = await fetchPage(
            user,
            `take=${String(PAGE_SIZE)}&skip=${String(2 * PAGE_SIZE)}&${sort}`,
        );
        expect(page3.data).toHaveLength(TOTAL_MISSIONS - 2 * PAGE_SIZE);

        // all pages together cover every mission exactly once
        const allUuids = new Set([
            ...page1Uuids,
            ...page2Uuids,
            ...page3.data.map((mission) => mission.uuid),
        ]);
        expect(allUuids.size).toBe(TOTAL_MISSIONS);

        // a skip beyond the end returns nothing but keeps the total count
        const emptyPage = await fetchPage(
            user,
            `take=${String(PAGE_SIZE)}&skip=${String(TOTAL_MISSIONS)}&${sort}`,
        );
        expect(emptyPage.data).toHaveLength(0);
        expect(emptyPage.count).toBe(TOTAL_MISSIONS);
    }, 60_000);

    test('honours take/skip for the minimal projection', async () => {
        const { user, projectUuid } = await setupTestEnvironment(
            'mission-pagination-minimal@kleinkram.dev',
            'Mission Pagination Minimal User',
        );

        for (let index = 1; index < TOTAL_MISSIONS; index++) {
            await createMissionUsingPost(
                {
                    name: `minimal_mission_${String(index).padStart(2, '0')}`,
                    projectUUID: projectUuid,
                    tags: {},
                    ignoreTags: true,
                },
                user,
            );
        }

        const sort = 'sortBy=name&sortOrder=asc';

        const page1 = await fetchPage(
            user,
            `minimal=true&take=${String(PAGE_SIZE)}&skip=0&${sort}`,
        );
        expect(page1.count).toBe(TOTAL_MISSIONS);
        expect(page1.data).toHaveLength(PAGE_SIZE);

        const page2 = await fetchPage(
            user,
            `minimal=true&take=${String(PAGE_SIZE)}&skip=${String(PAGE_SIZE)}&${sort}`,
        );
        expect(page2.data).toHaveLength(PAGE_SIZE);

        const page1Uuids = page1.data.map((mission) => mission.uuid);
        const page2Uuids = new Set(page2.data.map((mission) => mission.uuid));
        expect(page1Uuids.filter((uuid) => page2Uuids.has(uuid))).toHaveLength(
            0,
        );
    }, 60_000);
});
