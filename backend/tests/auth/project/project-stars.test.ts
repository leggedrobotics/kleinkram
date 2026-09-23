import { UserEntity } from '@kleinkram/backend-common';
import { UserRole } from '@kleinkram/shared';
import { createProjectUsingPost, getAuthHeaders } from '../../utils/api-calls';
import {
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

interface StarResponse {
    projectUuid: string;
    isStarred: boolean;
}

interface ProjectListEntry {
    uuid: string;
    isStarred: boolean;
}

const createUser = async (email: string, name: string): Promise<UserEntity> => {
    const userUuid = await mockDatabaseUser(email, name, UserRole.ADMIN);
    return getUserFromDatabase(userUuid);
};

const star = (user: UserEntity, projectUuid: string): Promise<Response> =>
    fetch(`${DEFAULT_URL}/projects/${projectUuid}/star`, {
        method: 'POST',
        headers: getAuthHeaders(user),
    });

const unstar = (user: UserEntity, projectUuid: string): Promise<Response> =>
    fetch(`${DEFAULT_URL}/projects/${projectUuid}/star`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
    });

const getProject = async (
    user: UserEntity,
    projectUuid: string,
): Promise<ProjectListEntry> => {
    const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as ProjectListEntry;
};

const listProjects = async (
    user: UserEntity,
    starredOnly: boolean,
): Promise<ProjectListEntry[]> => {
    const parameters = new URLSearchParams({
        take: '100',
        skip: '0',
        sortBy: 'name',
        sortOrder: 'ASC',
    });
    if (starredOnly) parameters.set('starred', 'true');

    const response = await fetch(
        `${DEFAULT_URL}/projects?${parameters.toString()}`,
        { method: 'GET', headers: getAuthHeaders(user) },
    );
    expect(response.status).toBe(200);

    const json = (await response.json()) as { data: ProjectListEntry[] };
    return json.data;
};

const isStarred = async (
    user: UserEntity,
    projectUuid: string,
): Promise<boolean> => {
    const project = await getProject(user, projectUuid);
    return project.isStarred;
};

const starredUuids = async (user: UserEntity): Promise<string[]> => {
    const projects = await listProjects(user, true);
    return projects.map((project) => project.uuid);
};

/**
 * Stars mark a project as a favorite of a single user. They must be private to
 * that user, survive being set twice, and drive both the `isStarred` flag and
 * the `starred=true` filter of the project list.
 */
describe('Project stars', () => {
    setupDatabaseHooks();

    test('starring a project is reflected on the project and in the list', async () => {
        const user = await createUser('stars@leggedrobotics.com', 'Stars User');
        const projectUuid = await createProjectUsingPost(
            {
                name: `stars_project_${String(Date.now())}`,
                description: 'Test project',
                requiredTags: [],
            },
            user,
        );

        expect(await isStarred(user, projectUuid)).toBe(false);
        expect(await starredUuids(user)).toStrictEqual([]);

        const response = await star(user, projectUuid);
        expect(response.status).toBe(201);
        expect((await response.json()) as StarResponse).toEqual({
            projectUuid,
            isStarred: true,
        });

        expect(await isStarred(user, projectUuid)).toBe(true);
        expect(await starredUuids(user)).toStrictEqual([projectUuid]);
    });

    test('starring twice does not create a second star', async () => {
        const user = await createUser(
            'stars-twice@leggedrobotics.com',
            'Stars Twice User',
        );
        const projectUuid = await createProjectUsingPost(
            {
                name: `stars_twice_project_${String(Date.now())}`,
                description: 'Test project',
                requiredTags: [],
            },
            user,
        );

        const first = await star(user, projectUuid);
        expect(first.status).toBe(201);
        const second = await star(user, projectUuid);
        expect(second.status).toBe(201);

        const starred = await starredUuids(user);
        expect(starred.filter((uuid) => uuid === projectUuid)).toHaveLength(1);
    });

    test('un-starring removes the star and is idempotent', async () => {
        const user = await createUser(
            'unstars@leggedrobotics.com',
            'Unstars User',
        );
        const projectUuid = await createProjectUsingPost(
            {
                name: `unstars_project_${String(Date.now())}`,
                description: 'Test project',
                requiredTags: [],
            },
            user,
        );

        const starResponse = await star(user, projectUuid);
        expect(starResponse.status).toBe(201);

        const response = await unstar(user, projectUuid);
        expect(response.status).toBe(200);
        expect((await response.json()) as StarResponse).toEqual({
            projectUuid,
            isStarred: false,
        });

        // Un-starring again must not fail, so that a retried request is safe.
        const retry = await unstar(user, projectUuid);
        expect(retry.status).toBe(200);

        expect(await isStarred(user, projectUuid)).toBe(false);
        expect(await starredUuids(user)).toStrictEqual([]);
    });

    test('a star of one user is invisible to another user', async () => {
        const owner = await createUser(
            'stars-owner@leggedrobotics.com',
            'Stars Owner',
        );
        const other = await createUser(
            'stars-other@leggedrobotics.com',
            'Stars Other',
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: `stars_private_project_${String(Date.now())}`,
                description: 'Test project',
                requiredTags: [],
            },
            owner,
        );

        const starResponse = await star(owner, projectUuid);
        expect(starResponse.status).toBe(201);

        expect(await isStarred(other, projectUuid)).toBe(false);
        expect(await starredUuids(other)).not.toContain(projectUuid);
    });
});
