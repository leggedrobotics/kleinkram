import {
    AccessGroupEntity,
    AccessGroupEventEntity,
    GroupMembershipEntity,
    ProjectAccessEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupEventType,
    AccessGroupRights,
    AccessGroupType,
} from '@kleinkram/shared';
import { randomUUID } from 'node:crypto';
import {
    createAccessGroupUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * `POST /access-groups/:uuid/users` and `POST /access-groups/:uuid/projects`
 * take a list and add all of it in one transaction, or nothing.
 */

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

const memberUuids = async (groupUuid: string): Promise<string[]> => {
    const memberships = await database
        .getRepository(GroupMembershipEntity)
        .find({
            where: { accessGroup: { uuid: groupUuid } },
            relations: { user: true },
        });
    return memberships.map((membership) => membership.user?.uuid ?? '');
};

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

const personalGroup = (user: UserEntity): Promise<AccessGroupEntity> =>
    database.getRepository(AccessGroupEntity).findOneOrFail({
        where: { name: user.name, type: AccessGroupType.PRIMARY },
    });

/** The audit log is written after the response, so wait for it. */
const waitForEvents = async (
    groupUuid: string,
    type: AccessGroupEventType,
    count: number,
): Promise<AccessGroupEventEntity[]> => {
    const repo = database.getRepository(AccessGroupEventEntity);
    let events: AccessGroupEventEntity[] = [];
    for (let attempt = 0; attempt < 40; attempt++) {
        events = await repo.find({
            where: { accessGroup: { uuid: groupUuid }, type },
        });
        if (events.length >= count) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return events;
};

const externalUser = async (): Promise<UserEntity> => {
    const { user } = await generateAndFetchDatabaseUser('external', 'user');
    return user;
};

/** A group edited by `creator`, who is its only member. */
const setupGroup = async (): Promise<{
    creator: UserEntity;
    groupUuid: string;
}> => {
    const { user: creator } = await generateAndFetchDatabaseUser(
        'internal',
        'user',
    );
    const groupUuid = await createAccessGroupUsingPost(
        { name: 'batch_members_group' },
        creator,
        [creator],
    );
    return { creator, groupUuid };
};

/**
 * Two projects owned by `owner`. `writer` is an external user (no
 * default rights) with the given rights on each of them.
 */
const setupProjects = async (
    writerRights: [
        AccessGroupRights | undefined,
        AccessGroupRights | undefined,
    ],
): Promise<{
    owner: UserEntity;
    writer: UserEntity;
    groupUuid: string;
    projectUuids: [string, string];
}> => {
    const { creator: owner, groupUuid } = await setupGroup();
    const writer = await externalUser();
    const writerGroup = await personalGroup(writer);

    const projectUuids: string[] = [];
    for (const [index, rights] of writerRights.entries()) {
        projectUuids.push(
            await createProjectUsingPost(
                {
                    name: `batch_members_project_${index.toString()}`,
                    description: 'Project for batch access group tests',
                    requiredTags: [],
                    ...(rights === undefined
                        ? {}
                        : {
                              accessGroups: [
                                  {
                                      rights,
                                      accessGroupUUID: writerGroup.uuid,
                                  },
                              ],
                          }),
                },
                owner,
            ),
        );
    }

    return {
        owner,
        writer,
        groupUuid,
        projectUuids: projectUuids as [string, string],
    };
};

describe('Batch Access Group Members', () => {
    setupDatabaseHooks();

    describe('POST /access-groups/:uuid/users', () => {
        test('should add all users in one call and log each of them', async () => {
            const { creator, groupUuid } = await setupGroup();
            const users = [
                await externalUser(),
                await externalUser(),
                await externalUser(),
            ];
            const expireDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const response = await post(
                creator,
                `/access-groups/${groupUuid}/users`,
                {
                    userUuids: users.map((user) => user.uuid),
                    canEditGroup: true,
                    expireDate: expireDate.toISOString(),
                },
            );

            expect(response.status).toBe(201);
            const memberships = await database
                .getRepository(GroupMembershipEntity)
                .find({
                    where: { accessGroup: { uuid: groupUuid } },
                    relations: { user: true },
                });
            const added = memberships.filter(
                (membership) => membership.user?.uuid !== creator.uuid,
            );
            expect(added).toHaveLength(users.length);
            expect(
                new Set(added.map((membership) => membership.user?.uuid)),
            ).toEqual(new Set(users.map((user) => user.uuid)));
            for (const membership of added) {
                expect(membership.canEditGroup).toBe(true);
                expect(membership.expirationDate).toBeInstanceOf(Date);
            }

            const events = await waitForEvents(
                groupUuid,
                AccessGroupEventType.ADD_USER,
                users.length,
            );
            expect(events).toHaveLength(users.length);
            expect(
                new Set(
                    events.map(
                        (event) =>
                            (event.details as { userUuid: string }).userUuid,
                    ),
                ),
            ).toEqual(new Set(users.map((user) => user.uuid)));
        });

        test('should answer 409 and add no user if one of them is already a member', async () => {
            const { creator, groupUuid } = await setupGroup();
            const member = await externalUser();
            const first = await externalUser();
            const second = await externalUser();

            const setup = await post(
                creator,
                `/access-groups/${groupUuid}/users`,
                { userUuids: [member.uuid] },
            );
            expect(setup.status).toBe(201);

            const response = await post(
                creator,
                `/access-groups/${groupUuid}/users`,
                { userUuids: [first.uuid, member.uuid, second.uuid] },
            );

            expect(response.status).toBe(409);
            const { message } = (await response.json()) as { message: string };
            expect(message).toContain('1 of the 3 users');
            expect(message).not.toContain('@');
            const members = await memberUuids(groupUuid);
            expect(members).toHaveLength(2);
            expect(new Set(members)).toEqual(
                new Set([creator.uuid, member.uuid]),
            );
        });

        test('should answer 404 and add no user if one of them does not exist', async () => {
            const { creator, groupUuid } = await setupGroup();
            const first = await externalUser();
            const second = await externalUser();

            const response = await post(
                creator,
                `/access-groups/${groupUuid}/users`,
                { userUuids: [first.uuid, randomUUID(), second.uuid] },
            );

            expect(response.status).toBe(404);
            expect(await memberUuids(groupUuid)).toEqual([creator.uuid]);
        });

        test('should answer 403 and add no user if the caller cannot edit the group', async () => {
            const { creator, groupUuid } = await setupGroup();
            const outsider = await externalUser();
            const target = await externalUser();

            const response = await post(
                outsider,
                `/access-groups/${groupUuid}/users`,
                { userUuids: [target.uuid, outsider.uuid] },
            );

            expect(response.status).toBe(403);
            expect(await memberUuids(groupUuid)).toEqual([creator.uuid]);
        });

        test('should answer 400 for an empty, duplicated, too long or old single-user list', async () => {
            const { creator, groupUuid } = await setupGroup();
            const target = await externalUser();
            const path = `/access-groups/${groupUuid}/users`;

            const bodies: unknown[] = [
                { userUuids: [] },
                { userUuids: [target.uuid, target.uuid] },
                { userUuids: [target.uuid, target.uuid.toUpperCase()] },
                { userUuids: [target.uuid, 'not-a-uuid'] },
                {
                    userUuids: Array.from({ length: 101 }, () => randomUUID()),
                },
                { userUuid: target.uuid },
                {},
            ];
            for (const body of bodies) {
                const response = await post(creator, path, body);
                expect(response.status).toBe(400);
            }
            expect(await memberUuids(groupUuid)).toEqual([creator.uuid]);
        });
    });

    describe('POST /access-groups/:uuid/projects', () => {
        test('should add the group to all projects in one call and log each of them', async () => {
            const { owner, groupUuid, projectUuids } = await setupProjects([
                undefined,
                undefined,
            ]);

            const response = await post(
                owner,
                `/access-groups/${groupUuid}/projects`,
                {
                    projects: [
                        {
                            projectUuid: projectUuids[0],
                            rights: AccessGroupRights.READ,
                        },
                        {
                            projectUuid: projectUuids[1],
                            rights: AccessGroupRights.WRITE,
                        },
                    ],
                },
            );

            expect(response.status).toBe(201);
            const projects = (await response.json()) as { uuid: string }[];
            expect(projects.map((project) => project.uuid)).toEqual(
                projectUuids,
            );
            expect(await storedRights(projectUuids[0], groupUuid)).toBe(
                AccessGroupRights.READ,
            );
            expect(await storedRights(projectUuids[1], groupUuid)).toBe(
                AccessGroupRights.WRITE,
            );

            const events = await waitForEvents(
                groupUuid,
                AccessGroupEventType.ADD_PROJECT,
                2,
            );
            expect(events).toHaveLength(2);
            expect(
                new Set(
                    events.map(
                        (event) =>
                            (event.details as { projectUuid: string })
                                .projectUuid,
                    ),
                ),
            ).toEqual(new Set(projectUuids));
        });

        test('should answer 403 and add the group to no project if the caller lacks write rights on one of them', async () => {
            const { writer, groupUuid, projectUuids } = await setupProjects([
                AccessGroupRights.WRITE,
                AccessGroupRights.READ,
            ]);

            const response = await post(
                writer,
                `/access-groups/${groupUuid}/projects`,
                {
                    projects: projectUuids.map((projectUuid) => ({
                        projectUuid,
                        rights: AccessGroupRights.READ,
                    })),
                },
            );

            expect(response.status).toBe(403);
            expect(
                await storedRights(projectUuids[0], groupUuid),
            ).toBeUndefined();
            expect(
                await storedRights(projectUuids[1], groupUuid),
            ).toBeUndefined();
        });

        test('should answer the same 403 for a project the caller cannot see and one that does not exist', async () => {
            const { writer, groupUuid, projectUuids } = await setupProjects([
                AccessGroupRights.WRITE,
                undefined,
            ]);
            const path = `/access-groups/${groupUuid}/projects`;
            const entry = (projectUuid: string) => ({
                projectUuid,
                rights: AccessGroupRights.READ,
            });

            const hidden = await post(writer, path, {
                projects: [entry(projectUuids[0]), entry(projectUuids[1])],
            });
            const missing = await post(writer, path, {
                projects: [entry(projectUuids[0]), entry(randomUUID())],
            });

            expect(hidden.status).toBe(403);
            expect(missing.status).toBe(403);
            expect(await hidden.json()).toEqual(await missing.json());
            expect(
                await storedRights(projectUuids[0], groupUuid),
            ).toBeUndefined();
        });

        test('should answer 409 and add the group to no project if one grant is above the rights of the caller', async () => {
            const { writer, groupUuid, projectUuids } = await setupProjects([
                AccessGroupRights.WRITE,
                AccessGroupRights.WRITE,
            ]);

            const response = await post(
                writer,
                `/access-groups/${groupUuid}/projects`,
                {
                    projects: [
                        {
                            projectUuid: projectUuids[0],
                            rights: AccessGroupRights.READ,
                        },
                        {
                            projectUuid: projectUuids[1],
                            rights: AccessGroupRights.DELETE,
                        },
                    ],
                },
            );

            expect(response.status).toBe(409);
            expect(
                await storedRights(projectUuids[0], groupUuid),
            ).toBeUndefined();
            expect(
                await storedRights(projectUuids[1], groupUuid),
            ).toBeUndefined();
        });

        test('should keep higher rights the group already has on a project', async () => {
            const { owner, groupUuid, projectUuids } = await setupProjects([
                undefined,
                undefined,
            ]);
            const path = `/access-groups/${groupUuid}/projects`;

            const first = await post(owner, path, {
                projects: [
                    {
                        projectUuid: projectUuids[0],
                        rights: AccessGroupRights.WRITE,
                    },
                ],
            });
            expect(first.status).toBe(201);

            const second = await post(owner, path, {
                projects: projectUuids.map((projectUuid) => ({
                    projectUuid,
                    rights: AccessGroupRights.READ,
                })),
            });

            expect(second.status).toBe(201);
            expect(await storedRights(projectUuids[0], groupUuid)).toBe(
                AccessGroupRights.WRITE,
            );
            expect(await storedRights(projectUuids[1], groupUuid)).toBe(
                AccessGroupRights.READ,
            );
        });

        test('should answer 400 for an empty, duplicated or old single-project body', async () => {
            const { owner, groupUuid, projectUuids } = await setupProjects([
                undefined,
                undefined,
            ]);
            const path = `/access-groups/${groupUuid}/projects`;
            const entry = {
                projectUuid: projectUuids[0],
                rights: AccessGroupRights.READ,
            };

            const bodies: unknown[] = [
                { projects: [] },
                { projects: [entry, entry] },
                {
                    projects: [
                        entry,
                        {
                            projectUuid: projectUuids[0].toUpperCase(),
                            rights: AccessGroupRights.WRITE,
                        },
                    ],
                },
                { projects: [{ projectUuid: projectUuids[0] }] },
                { projects: [{ ...entry, rights: AccessGroupRights._ADMIN }] },
                { rights: AccessGroupRights.READ },
                {},
            ];
            for (const body of bodies) {
                const response = await post(owner, path, body);
                expect(response.status).toBe(400);
            }
            expect(
                await storedRights(projectUuids[0], groupUuid),
            ).toBeUndefined();
        });

        test('should no longer serve the route that added one project', async () => {
            const { owner, groupUuid, projectUuids } = await setupProjects([
                undefined,
                undefined,
            ]);

            const response = await post(
                owner,
                `/access-groups/${groupUuid}/projects/${projectUuids[0]}`,
                { rights: AccessGroupRights.READ },
            );

            expect(response.status).toBe(404);
            expect(
                await storedRights(projectUuids[0], groupUuid),
            ).toBeUndefined();
        });
    });
});
