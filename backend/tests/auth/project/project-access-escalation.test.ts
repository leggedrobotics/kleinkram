import {
    AccessGroupEntity,
    GroupMembershipEntity,
    ProjectAccessEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import {
    createAccessGroupUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * A caller may only grant, change or remove a project access entry if they
 * hold at least the rights the entry has before and after the change.
 * Covers all three endpoints that write project access:
 *  - POST /projects/:uuid/users
 *  - POST /access-groups/:uuid/projects/:projectUuid
 *  - POST /projects/:uuid/access
 */

interface ProjectAccessEntry {
    uuid: string;
    name: string;
    type: AccessGroupType;
    memberCount: number;
    rights: AccessGroupRights;
}

const post = (
    user: UserEntity,
    path: string,
    body: unknown,
): Promise<Response> => {
    const headers = new HeaderCreator(user);
    headers.addHeader('Content-Type', 'application/json');
    return fetch(`${DEFAULT_URL}${path}`, {
        method: 'POST',
        headers: headers.getHeaders(),
        body: JSON.stringify(body),
    });
};

const personalGroup = (user: UserEntity): Promise<AccessGroupEntity> =>
    database.getRepository(AccessGroupEntity).findOneOrFail({
        where: { name: user.name, type: AccessGroupType.PRIMARY },
    });

const storedRights = async (
    projectUuid: string,
    groupUuid: string,
): Promise<AccessGroupRights | undefined> => {
    const access = await database.getRepository(ProjectAccessEntity).findOne({
        where: {
            project: { uuid: projectUuid },
            accessGroup: { uuid: groupUuid },
        },
    });
    return access?.rights;
};

const getProjectAccess = async (
    user: UserEntity,
    projectUuid: string,
): Promise<ProjectAccessEntry[]> => {
    const response = await fetch(
        `${DEFAULT_URL}/projects/${projectUuid}/access`,
        { method: 'GET', headers: new HeaderCreator(user).getHeaders() },
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: ProjectAccessEntry[] };
    return json.data;
};

/**
 * A project owned by `owner` (DELETE), with `writer` (WRITE) and
 * `coOwner` (DELETE) on their personal groups. Writer and co-owner are
 * external users, so they get no rights from the default access config.
 */
const setupProject = async (): Promise<{
    owner: UserEntity;
    writer: UserEntity;
    coOwner: UserEntity;
    projectUuid: string;
    writerGroup: AccessGroupEntity;
    coOwnerGroup: AccessGroupEntity;
}> => {
    const { user: owner } = await generateAndFetchDatabaseUser(
        'internal',
        'user',
    );
    const { user: writer } = await generateAndFetchDatabaseUser(
        'external',
        'user',
    );
    const { user: coOwner } = await generateAndFetchDatabaseUser(
        'external',
        'user',
    );
    const writerGroup = await personalGroup(writer);
    const coOwnerGroup = await personalGroup(coOwner);

    const projectUuid = await createProjectUsingPost(
        {
            name: 'rights_escalation_project',
            description: 'Project for rights escalation tests',
            accessGroups: [
                {
                    rights: AccessGroupRights.WRITE,
                    accessGroupUUID: writerGroup.uuid,
                },
                {
                    rights: AccessGroupRights.DELETE,
                    accessGroupUUID: coOwnerGroup.uuid,
                },
            ],
        },
        owner,
    );

    return { owner, writer, coOwner, projectUuid, writerGroup, coOwnerGroup };
};

describe('Project Access Rights Escalation', () => {
    setupDatabaseHooks();

    describe('POST /projects/:uuid/users', () => {
        test('should reject a writer granting themselves _ADMIN rights', async () => {
            const { writer, projectUuid, writerGroup } = await setupProject();

            const response = await post(
                writer,
                `/projects/${projectUuid}/users`,
                { userUuid: writer.uuid, rights: AccessGroupRights._ADMIN },
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should reject a writer lowering the rights of a delete user', async () => {
            const { writer, coOwner, projectUuid, coOwnerGroup } =
                await setupProject();

            const response = await post(
                writer,
                `/projects/${projectUuid}/users`,
                { userUuid: coOwner.uuid, rights: AccessGroupRights.READ },
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, coOwnerGroup.uuid)).toBe(
                AccessGroupRights.DELETE,
            );
        });

        test('should allow a writer to add a user with write rights', async () => {
            const { writer, projectUuid } = await setupProject();
            const { user: newcomer } = await generateAndFetchDatabaseUser(
                'external',
                'user',
            );

            const response = await post(
                writer,
                `/projects/${projectUuid}/users`,
                { userUuid: newcomer.uuid, rights: AccessGroupRights.WRITE },
            );

            expect(response.status).toBe(201);
            const newcomerGroup = await personalGroup(newcomer);
            expect(await storedRights(projectUuid, newcomerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should allow a delete user to lower the rights of another delete user', async () => {
            const { owner, coOwner, projectUuid, coOwnerGroup } =
                await setupProject();

            const response = await post(
                owner,
                `/projects/${projectUuid}/users`,
                { userUuid: coOwner.uuid, rights: AccessGroupRights.READ },
            );

            expect(response.status).toBe(201);
            expect(await storedRights(projectUuid, coOwnerGroup.uuid)).toBe(
                AccessGroupRights.READ,
            );
        });
    });

    describe('POST /access-groups/:uuid/projects/:projectUuid', () => {
        test('should reject a writer granting their own group _ADMIN rights', async () => {
            const { writer, projectUuid, writerGroup } = await setupProject();

            const response = await post(
                writer,
                `/access-groups/${writerGroup.uuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights._ADMIN },
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should reject a writer granting delete rights', async () => {
            const { writer, projectUuid, writerGroup } = await setupProject();

            const response = await post(
                writer,
                `/access-groups/${writerGroup.uuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights.DELETE },
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should allow a writer to add a group with write rights', async () => {
            const { writer, projectUuid } = await setupProject();
            const { user: newcomer } = await generateAndFetchDatabaseUser(
                'external',
                'user',
            );
            const newcomerGroup = await personalGroup(newcomer);

            const response = await post(
                writer,
                `/access-groups/${newcomerGroup.uuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights.WRITE },
            );

            expect(response.status).toBe(201);
            expect(await storedRights(projectUuid, newcomerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });
    });

    describe('POST /projects/:uuid/access', () => {
        test('should reject a writer lowering the rights of a delete group', async () => {
            const { writer, projectUuid, coOwnerGroup } = await setupProject();
            const access = await getProjectAccess(writer, projectUuid);

            const response = await post(
                writer,
                `/projects/${projectUuid}/access`,
                access.map((entry) =>
                    entry.uuid === coOwnerGroup.uuid
                        ? { ...entry, rights: AccessGroupRights.READ }
                        : entry,
                ),
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, coOwnerGroup.uuid)).toBe(
                AccessGroupRights.DELETE,
            );
        });

        test('should reject a writer removing a delete group', async () => {
            const { writer, projectUuid, coOwnerGroup } = await setupProject();
            const access = await getProjectAccess(writer, projectUuid);

            const response = await post(
                writer,
                `/projects/${projectUuid}/access`,
                access.filter((entry) => entry.uuid !== coOwnerGroup.uuid),
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, coOwnerGroup.uuid)).toBe(
                AccessGroupRights.DELETE,
            );
        });

        test('should reject a writer listing a group twice to sneak in delete rights', async () => {
            const { writer, projectUuid, writerGroup } = await setupProject();
            const access = await getProjectAccess(writer, projectUuid);
            const writerEntry = access.find(
                (entry) => entry.uuid === writerGroup.uuid,
            );
            expect(writerEntry).toBeDefined();

            const response = await post(
                writer,
                `/projects/${projectUuid}/access`,
                [
                    { ...writerEntry, rights: AccessGroupRights.DELETE },
                    ...access,
                ],
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should reject a writer whose delete membership expired granting delete rights', async () => {
            const { owner, writer, projectUuid, writerGroup } =
                await setupProject();

            // a group with DELETE rights on the project, in which the
            // writer's membership expired a day ago
            const formerOwnersUuid = await createAccessGroupUsingPost(
                { name: 'former_owners' },
                owner,
                [owner, writer],
            );
            const membershipRepo = database.getRepository(
                GroupMembershipEntity,
            );
            const membership = await membershipRepo.findOneOrFail({
                where: {
                    accessGroup: { uuid: formerOwnersUuid },
                    user: { uuid: writer.uuid },
                },
            });
            membership.expirationDate = new Date(
                Date.now() - 24 * 60 * 60 * 1000,
            );
            await membershipRepo.save(membership);
            const grantResponse = await post(
                owner,
                `/access-groups/${formerOwnersUuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights.DELETE },
            );
            expect(grantResponse.status).toBe(201);

            const access = await getProjectAccess(writer, projectUuid);
            const response = await post(
                writer,
                `/projects/${projectUuid}/access`,
                access.map((entry) =>
                    entry.uuid === writerGroup.uuid
                        ? { ...entry, rights: AccessGroupRights.DELETE }
                        : entry,
                ),
            );

            expect(response.status).toBe(409);
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should allow a writer to change entries at or below write rights', async () => {
            const { writer, projectUuid, writerGroup } = await setupProject();
            const { user: newcomer } = await generateAndFetchDatabaseUser(
                'external',
                'user',
            );
            const newcomerGroup = await personalGroup(newcomer);
            const access = await getProjectAccess(writer, projectUuid);

            const response = await post(
                writer,
                `/projects/${projectUuid}/access`,
                [
                    ...access,
                    {
                        uuid: newcomerGroup.uuid,
                        name: newcomerGroup.name,
                        type: newcomerGroup.type,
                        memberCount: 1,
                        rights: AccessGroupRights.CREATE,
                    },
                ],
            );

            expect(response.status).toBe(201);
            expect(await storedRights(projectUuid, newcomerGroup.uuid)).toBe(
                AccessGroupRights.CREATE,
            );
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.WRITE,
            );
        });

        test('should allow a delete user to lower entries and remove a delete group', async () => {
            const { owner, projectUuid, coOwnerGroup, writerGroup } =
                await setupProject();
            const access = await getProjectAccess(owner, projectUuid);

            const response = await post(
                owner,
                `/projects/${projectUuid}/access`,
                access
                    .filter((entry) => entry.uuid !== coOwnerGroup.uuid)
                    .map((entry) =>
                        entry.uuid === writerGroup.uuid
                            ? { ...entry, rights: AccessGroupRights.READ }
                            : entry,
                    ),
            );

            expect(response.status).toBe(201);
            expect(
                await storedRights(projectUuid, coOwnerGroup.uuid),
            ).toBeUndefined();
            expect(await storedRights(projectUuid, writerGroup.uuid)).toBe(
                AccessGroupRights.READ,
            );
        });
    });
});
