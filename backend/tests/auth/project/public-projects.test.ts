import { AccessGroupEntity, UserEntity } from '@kleinkram/backend-common';
import {
    AccessGroupRights,
    AccessGroupType,
    PUBLIC_ACCESS_GROUP,
} from '@kleinkram/shared';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

interface ProjectAccessEntry {
    uuid: string;
    name: string;
    type: AccessGroupType;
    memberCount: number;
    rights: AccessGroupRights;
}

interface ProjectEntry {
    uuid: string;
    isPublic: boolean;
}

const jsonHeaders = (user: UserEntity): Record<string, string> => ({
    ...getAuthHeaders(user),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
});

const getProjectAccess = async (
    user: UserEntity,
    projectUuid: string,
): Promise<ProjectAccessEntry[]> => {
    const response = await fetch(
        `${DEFAULT_URL}/projects/${projectUuid}/access`,
        { method: 'GET', headers: getAuthHeaders(user) },
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: ProjectAccessEntry[] };
    return json.data;
};

const setProjectAccess = (
    user: UserEntity,
    projectUuid: string,
    access: ProjectAccessEntry[],
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/projects/${projectUuid}/access`, {
        method: 'POST',
        headers: jsonHeaders(user),
        body: JSON.stringify(access),
    });

const publicAccess = (rights: AccessGroupRights): ProjectAccessEntry => ({
    uuid: PUBLIC_ACCESS_GROUP.uuid,
    name: PUBLIC_ACCESS_GROUP.name,
    type: AccessGroupType.PUBLIC,
    memberCount: 0,
    rights,
});

/** Sets the general access of a project, keeping all other access rights. */
const setPublic = async (
    owner: UserEntity,
    projectUuid: string,
    isPublic: boolean,
): Promise<void> => {
    const current = await getProjectAccess(owner, projectUuid);
    const withoutPublic = current.filter(
        (access) => access.uuid !== PUBLIC_ACCESS_GROUP.uuid,
    );
    const response = await setProjectAccess(
        owner,
        projectUuid,
        isPublic
            ? [...withoutPublic, publicAccess(AccessGroupRights.READ)]
            : withoutPublic,
    );
    expect(response.status).toBe(201);
};

const getProject = (user: UserEntity, projectUuid: string): Promise<Response> =>
    fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });

const getProjectStatus = async (
    user: UserEntity,
    projectUuid: string,
): Promise<number> => {
    const response = await getProject(user, projectUuid);
    return response.status;
};

const listProjects = async (
    user: UserEntity,
    publicOnly = false,
): Promise<ProjectEntry[]> => {
    const parameters = new URLSearchParams({
        take: '100',
        skip: '0',
        sortBy: 'name',
        sortOrder: 'ASC',
    });
    if (publicOnly) parameters.set('public', 'true');

    const response = await fetch(
        `${DEFAULT_URL}/projects?${parameters.toString()}`,
        { method: 'GET', headers: getAuthHeaders(user) },
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: ProjectEntry[] };
    return json.data;
};

const listProjectUuids = async (
    user: UserEntity,
    publicOnly = false,
): Promise<string[]> => {
    const projects = await listProjects(user, publicOnly);
    return projects.map((project) => project.uuid);
};

const getAccessGroupUuids = async (
    user: UserEntity,
    projectUuid: string,
): Promise<string[]> => {
    const access = await getProjectAccess(user, projectUuid);
    return access.map((entry) => entry.uuid);
};

const createProject = (owner: UserEntity, name: string): Promise<string> =>
    createProjectUsingPost(
        { name, description: 'Public project test', requiredTags: [] },
        owner,
    );

/**
 * A project is public when it grants the public access group access. Every
 * user can then read it without being a member of any of its groups, but
 * public access never goes beyond READ.
 */
describe('Public projects', () => {
    setupDatabaseHooks();

    test('if a user without any group can read a public project', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: outsider } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const projectUuid = await createProject(owner, 'public_read');
        const missionUuid = await createMissionUsingPost(
            {
                name: 'public_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            owner,
        );

        // restricted by default
        expect(await getProjectStatus(outsider, projectUuid)).toBe(403);
        expect(await listProjectUuids(outsider)).not.toContain(projectUuid);

        await setPublic(owner, projectUuid, true);

        const projectResponse = await getProject(outsider, projectUuid);
        expect(projectResponse.status).toBe(200);
        expect(((await projectResponse.json()) as ProjectEntry).isPublic).toBe(
            true,
        );

        const listed = await listProjects(outsider);
        expect(listed).toContainEqual(
            expect.objectContaining({ uuid: projectUuid, isPublic: true }),
        );

        const missionResponse = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}`,
            { method: 'GET', headers: getAuthHeaders(outsider) },
        );
        expect(missionResponse.status).toBe(200);

        const permissionsResponse = await fetch(
            `${DEFAULT_URL}/users/me/permissions`,
            { method: 'GET', headers: getAuthHeaders(outsider) },
        );
        expect(permissionsResponse.status).toBe(200);
        const permissions = (await permissionsResponse.json()) as {
            projects: { uuid: string; access: AccessGroupRights }[];
        };
        expect(permissions.projects).toContainEqual({
            uuid: projectUuid,
            access: AccessGroupRights.READ,
        });
    });

    test('if public access does not allow writing', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: outsider } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const projectUuid = await createProject(owner, 'public_no_write');
        await setPublic(owner, projectUuid, true);

        const createMission = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: jsonHeaders(outsider),
            body: JSON.stringify({
                name: 'intruder_mission',
                projectUUID: projectUuid,
                tags: {},
            }),
        });
        expect(createMission.status).toBe(403);

        const changeAccess = await setProjectAccess(outsider, projectUuid, [
            publicAccess(AccessGroupRights.READ),
        ]);
        expect(changeAccess.status).toBe(403);
    });

    test('if a user who signs up later can read a public project', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const projectUuid = await createProject(owner, 'public_new_user');
        await setPublic(owner, projectUuid, true);

        const { user: newcomer } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        expect(await getProjectStatus(newcomer, projectUuid)).toBe(200);
    });

    test('if making a project restricted again removes public access', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: outsider } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const projectUuid = await createProject(owner, 'public_then_private');
        await setPublic(owner, projectUuid, true);
        expect(await getProjectStatus(outsider, projectUuid)).toBe(200);

        await setPublic(owner, projectUuid, false);
        expect(await getProjectStatus(outsider, projectUuid)).toBe(403);

        const ownerResponse = await getProject(owner, projectUuid);
        const ownerView = (await ownerResponse.json()) as ProjectEntry;
        expect(ownerView.isPublic).toBe(false);
    });

    test('if the public filter only returns public projects', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const publicUuid = await createProject(owner, 'filter_public');
        const restrictedUuid = await createProject(owner, 'filter_restricted');
        await setPublic(owner, publicUuid, true);

        const all = await listProjectUuids(owner);
        expect(all).toEqual(
            expect.arrayContaining([publicUuid, restrictedUuid]),
        );

        const publicOnly = await listProjects(owner, true);
        expect(publicOnly.map((project) => project.uuid)).toStrictEqual([
            publicUuid,
        ]);
    });

    test('if public access cannot be granted more than read rights', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const projectUuid = await createProject(owner, 'public_rights_cap');
        const current = await getProjectAccess(owner, projectUuid);

        for (const rights of [
            AccessGroupRights.CREATE,
            AccessGroupRights.WRITE,
            AccessGroupRights.DELETE,
        ]) {
            const replace = await setProjectAccess(owner, projectUuid, [
                ...current,
                publicAccess(rights),
            ]);
            expect(replace.status).toBe(409);

            const add = await fetch(
                `${DEFAULT_URL}/access-groups/${PUBLIC_ACCESS_GROUP.uuid}/projects/${projectUuid}`,
                {
                    method: 'POST',
                    headers: jsonHeaders(owner),
                    body: JSON.stringify({ rights }),
                },
            );
            expect(add.status).toBe(409);
        }

        // nothing was granted
        expect(await getAccessGroupUuids(owner, projectUuid)).not.toContain(
            PUBLIC_ACCESS_GROUP.uuid,
        );
    });

    test('if a project cannot be created with more than read rights for the public', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const response = await fetch(`${DEFAULT_URL}/projects`, {
            method: 'POST',
            headers: jsonHeaders(owner),
            body: JSON.stringify({
                name: 'public_write_on_create',
                description: 'must be rejected',
                requiredTags: [],
                accessGroups: [
                    {
                        accessGroupUUID: PUBLIC_ACCESS_GROUP.uuid,
                        rights: AccessGroupRights.WRITE,
                    },
                ],
            }),
        });
        expect(response.status).toBe(409);

        const created = await listProjects(owner);
        expect(created).toStrictEqual([]);
    });

    test('if the members of the public group cannot be changed', async () => {
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: other } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const addUser = await fetch(
            `${DEFAULT_URL}/access-groups/${PUBLIC_ACCESS_GROUP.uuid}/users`,
            {
                method: 'POST',
                headers: jsonHeaders(admin),
                body: JSON.stringify({ userUuid: other.uuid }),
            },
        );
        expect(addUser.status).toBe(409);

        const deleteGroup = await fetch(
            `${DEFAULT_URL}/access-groups/${PUBLIC_ACCESS_GROUP.uuid}`,
            { method: 'DELETE', headers: getAuthHeaders(admin) },
        );
        expect(deleteGroup.status).toBe(409);

        const group = await database
            .getRepository(AccessGroupEntity)
            .findOneOrFail({
                where: { uuid: PUBLIC_ACCESS_GROUP.uuid },
                relations: { memberships: true },
            });
        expect(group.memberships).toStrictEqual([]);
    });

    test('if the public group does not show up in the group search', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const response = await fetch(
            `${DEFAULT_URL}/access-groups?search=${encodeURIComponent(PUBLIC_ACCESS_GROUP.name)}&skip=0&take=20`,
            { method: 'GET', headers: getAuthHeaders(user) },
        );
        expect(response.status).toBe(200);
        const json = (await response.json()) as { data: { uuid: string }[] };
        expect(json.data.map((group) => group.uuid)).not.toContain(
            PUBLIC_ACCESS_GROUP.uuid,
        );
    });
});
