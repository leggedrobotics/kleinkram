import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    FileType,
} from '@kleinkram/shared';
import { In } from 'typeorm';
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
    monthly: { month: string; bytes: number }[];
    byProject: { uuid: string; bytes: number }[];
    otherProjects: { bytes: number; projectCount: number } | null;
    byType: { type: string; bytes: number }[];
    largestMissions: { missionUuid: string; bytes: number }[];
}

const insertFile = async (
    missionUuid: string,
    creator: UserEntity,
    type: FileType,
    size: number,
): Promise<void> => {
    const repository = database.getRepository(FileEntity);
    await repository.save(
        repository.create({
            filename: `file_${crypto.randomUUID().slice(0, 8)}.${type.toLowerCase()}`,
            mission: { uuid: missionUuid },
            creator: { uuid: creator.uuid },
            date: new Date(),
            type,
            size,
        }),
    );
};

/** READ access to the project through the user's primary access group */
const grantRead = async (user: UserEntity, projectUuid: string) => {
    const withGroups = await database.getRepository(UserEntity).findOneOrFail({
        where: { uuid: user.uuid },
        relations: { memberships: { accessGroup: true } },
    });
    const primaryGroup = withGroups.memberships?.find(
        (membership) =>
            membership.accessGroup?.type === AccessGroupType.PRIMARY,
    )?.accessGroup;
    if (!primaryGroup) throw new Error('User has no primary access group');
    const repository = database.getRepository(ProjectAccessEntity);
    await repository.save(
        repository.create({
            project: { uuid: projectUuid } as ProjectEntity,
            accessGroup: primaryGroup,
            rights: AccessGroupRights.READ,
        }),
    );
};

const getInsights = async (
    user: UserEntity,
): Promise<{ status: number; raw: string; body: InsightsBody }> => {
    const response = await fetch(`${DEFAULT_URL}/files/storage/insights`, {
        headers: getAuthHeaders(user),
    });
    const raw = await response.text();
    return {
        status: response.status,
        raw,
        body: (response.status === 200 ? JSON.parse(raw) : {}) as InsightsBody,
    };
};

/**
 * Project A (300 bytes: a .bag and an .mcap) and project B (5000 bytes,
 * .yaml). Only the given user is granted READ on A; the projects' default
 * access is removed so nothing else grants access.
 */
const setup = async () => {
    const { user: admin } = await generateAndFetchDatabaseUser(
        'external',
        'admin',
    );
    const { user } = await generateAndFetchDatabaseUser('internal', 'user');
    const suffix = String(Date.now());
    const project = (name: string): Promise<string> =>
        createProjectUsingPost(
            {
                name: `${name}_${suffix}`,
                description: 'Storage insights access test',
                requiredMetadataTypes: [],
            },
            admin,
        );
    const projectA = await project('readable');
    const projectB = await project('secret');
    const mission = (name: string, projectUuid: string): Promise<string> =>
        createMissionUsingPost(
            {
                name: `${name}_${suffix}`,
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            admin,
        );
    const missionA = await mission('mission_a', projectA);
    const missionB = await mission('mission_b', projectB);

    await database
        .getRepository(ProjectAccessEntity)
        .delete({ project: { uuid: In([projectA, projectB]) } });
    await grantRead(user, projectA);

    await insertFile(missionA, admin, FileType.BAG, 100);
    await insertFile(missionA, admin, FileType.MCAP, 200);
    await insertFile(missionB, admin, FileType.YAML, 5000);

    return { admin, user, projectA, projectB, missionA, missionB, suffix };
};

describe('Storage Insights Access', () => {
    setupDatabaseHooks();

    test('should limit the statistics to the projects the user can read', async () => {
        const { user, projectA, projectB, missionA, missionB, suffix } =
            await setup();

        const { status, raw, body } = await getInsights(user);

        expect(status).toBe(200);
        expect(body.totals).toEqual({
            bytes: 300,
            fileCount: 2,
            projectCount: 1,
        });
        expect(body.last30Days).toEqual({ bytes: 300, fileCount: 2 });
        expect(body.monthly.at(-1)?.bytes).toBe(300);
        expect(body.byProject.map((project) => project.uuid)).toEqual([
            projectA,
        ]);
        expect(body.otherProjects).toBeNull();
        expect(body.byType).toHaveLength(2);
        expect(body.byType.map((type) => type.type)).toEqual(
            expect.arrayContaining([FileType.BAG, FileType.MCAP]),
        );
        expect(
            body.largestMissions.map((mission) => mission.missionUuid),
        ).toEqual([missionA]);

        // nothing about project B anywhere in the response
        expect(raw).not.toContain(projectB);
        expect(raw).not.toContain(missionB);
        expect(raw).not.toContain(`secret_${suffix}`);
        expect(raw).not.toContain(FileType.YAML);
    });

    test('should show everything to an admin', async () => {
        const { admin, projectA, projectB } = await setup();

        const { status, body } = await getInsights(admin);

        expect(status).toBe(200);
        expect(body.totals).toEqual({
            bytes: 5300,
            fileCount: 3,
            projectCount: 2,
        });
        expect(body.byProject.map((project) => project.uuid)).toEqual([
            projectB,
            projectA,
        ]);
    });

    test('should return 403 Forbidden to an external user', async () => {
        await setup();
        const { user } = await generateAndFetchDatabaseUser('external', 'user');

        const { status } = await getInsights(user);

        expect(status).toBe(403);
    });

    test('should drop a project from the numbers once its access is removed', async () => {
        const { user, projectA } = await setup();
        await database
            .getRepository(ProjectAccessEntity)
            .delete({ project: { uuid: projectA } });

        const { status, raw, body } = await getInsights(user);

        expect(status).toBe(200);
        expect(body.totals).toEqual({
            bytes: 0,
            fileCount: 0,
            projectCount: 0,
        });
        expect(body.byProject).toEqual([]);
        expect(body.byType).toEqual([]);
        expect(body.largestMissions).toEqual([]);
        expect(body.monthly.every((month) => month.bytes === 0)).toBe(true);
        expect(raw).not.toContain(projectA);
    });
});
