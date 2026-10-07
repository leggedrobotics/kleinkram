import {
    AccessGroupEntity,
    ProjectAccessEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights } from '@kleinkram/shared';
import { createProjectUsingPost, HeaderCreator } from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * This test suite tests the access control of the application.
 *
 */

/** Creates a project on which a fresh user has WRITE rights. */
const setupWriteUser = async (): Promise<{
    creator: UserEntity;
    writer: UserEntity;
    writerGroup: AccessGroupEntity;
    projectUuid: string;
}> => {
    const { user: creator } = await generateAndFetchDatabaseUser(
        'internal',
        'user',
    );
    const { user: writer } = await generateAndFetchDatabaseUser(
        'internal',
        'user',
    );
    const writerGroup = await database
        .getRepository<AccessGroupEntity>(AccessGroupEntity)
        .findOneOrFail({ where: { name: writer.name } });

    const projectUuid = await createProjectUsingPost(
        {
            name: 'admin_escalation_project',
            description: 'Project with a WRITE user',
            accessGroups: [
                {
                    rights: AccessGroupRights.WRITE,
                    accessGroupUUID: writerGroup.uuid,
                },
            ],
        },
        creator,
    );
    return { creator, writer, writerGroup, projectUuid };
};

const expectWriterStillHasWrite = async (
    writerGroup: AccessGroupEntity,
    projectUuid: string,
): Promise<void> => {
    const access = await database
        .getRepository<ProjectAccessEntity>(ProjectAccessEntity)
        .findOneOrFail({
            where: {
                accessGroup: { uuid: writerGroup.uuid },
                project: { uuid: projectUuid },
            },
        });
    expect(access.rights).toBe(AccessGroupRights.WRITE);
};

describe('Verify Project Groups Access', () => {
    setupDatabaseHooks();

    test('if user can add project with read access to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Get the other user's personal access group
        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        // Create project with READ access for the other user's group
        const projectUuid = await createProjectUsingPost(
            {
                name: 'read_access_project',
                description: 'Project with READ access',
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        // Verify the access was set correctly
        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const access = await projectAccessRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: otherUserGroup.uuid },
                project: { uuid: projectUuid },
            },
            relations: {
                accessGroup: true,
                project: true,
            },
        });
        expect(access.rights).toBe(AccessGroupRights.READ);
    });

    test('if user can add project with create access to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'create_access_project',
                description: 'Project with CREATE access',
                accessGroups: [
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const access = await projectAccessRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: otherUserGroup.uuid },
                project: { uuid: projectUuid },
            },
            relations: {
                accessGroup: true,
                project: true,
            },
        });
        expect(access.rights).toBe(AccessGroupRights.CREATE);
    });

    test('if user can add project with write access to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'write_access_project',
                description: 'Project with WRITE access',
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const access = await projectAccessRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: otherUserGroup.uuid },
                project: { uuid: projectUuid },
            },
            relations: {
                accessGroup: true,
                project: true,
            },
        });
        expect(access.rights).toBe(AccessGroupRights.WRITE);
    });

    test('if user can add project with delete access to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'delete_access_project',
                description: 'Project with DELETE access',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const access = await projectAccessRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: otherUserGroup.uuid },
                project: { uuid: projectUuid },
            },
            relations: {
                accessGroup: true,
                project: true,
            },
        });
        expect(access.rights).toBe(AccessGroupRights.DELETE);
    });

    test('if user can add multiple projects with read rights to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid1 = await createProjectUsingPost(
            {
                name: 'multi_read_project_1',
                description: 'First project with READ',
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectUuid2 = await createProjectUsingPost(
            {
                name: 'multi_read_project_2',
                description: 'Second project with READ',
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const accesses = await projectAccessRepo.find({
            where: { accessGroup: { uuid: otherUserGroup.uuid } },
            relations: {
                accessGroup: true,
                project: true,
            },
        });

        const matchingAccesses = accesses.filter(
            (a) =>
                a.project?.uuid === projectUuid1 ||
                a.project?.uuid === projectUuid2,
        );
        expect(matchingAccesses.length).toBe(2);
        for (const access of matchingAccesses) {
            expect(access.rights).toBe(AccessGroupRights.READ);
        }
    });

    test('if user can add multiple projects with create rights to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid1 = await createProjectUsingPost(
            {
                name: 'multi_create_project_1',
                description: 'First project with CREATE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectUuid2 = await createProjectUsingPost(
            {
                name: 'multi_create_project_2',
                description: 'Second project with CREATE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const accesses = await projectAccessRepo.find({
            where: { accessGroup: { uuid: otherUserGroup.uuid } },
            relations: {
                accessGroup: true,
                project: true,
            },
        });

        const matchingAccesses = accesses.filter(
            (a) =>
                a.project?.uuid === projectUuid1 ||
                a.project?.uuid === projectUuid2,
        );
        expect(matchingAccesses.length).toBe(2);
        for (const access of matchingAccesses) {
            expect(access.rights).toBe(AccessGroupRights.CREATE);
        }
    });

    test('if user can add multiple projects with write rights to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid1 = await createProjectUsingPost(
            {
                name: 'multi_write_project_1',
                description: 'First project with WRITE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectUuid2 = await createProjectUsingPost(
            {
                name: 'multi_write_project_2',
                description: 'Second project with WRITE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const accesses = await projectAccessRepo.find({
            where: { accessGroup: { uuid: otherUserGroup.uuid } },
            relations: {
                accessGroup: true,
                project: true,
            },
        });

        const matchingAccesses = accesses.filter(
            (a) =>
                a.project?.uuid === projectUuid1 ||
                a.project?.uuid === projectUuid2,
        );
        expect(matchingAccesses.length).toBe(2);
        for (const access of matchingAccesses) {
            expect(access.rights).toBe(AccessGroupRights.WRITE);
        }
    });

    test('if user can add multiple projects with delete rights to existing access group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: otherUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const accessGroupRepo =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const otherUserGroup = await accessGroupRepo.findOneOrFail({
            where: { name: otherUser.name },
        });

        const projectUuid1 = await createProjectUsingPost(
            {
                name: 'multi_delete_project_1',
                description: 'First project with DELETE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectUuid2 = await createProjectUsingPost(
            {
                name: 'multi_delete_project_2',
                description: 'Second project with DELETE',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: otherUserGroup.uuid,
                    },
                ],
            },
            creator,
        );

        const projectAccessRepo =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const accesses = await projectAccessRepo.find({
            where: { accessGroup: { uuid: otherUserGroup.uuid } },
            relations: {
                accessGroup: true,
                project: true,
            },
        });

        const matchingAccesses = accesses.filter(
            (a) =>
                a.project?.uuid === projectUuid1 ||
                a.project?.uuid === projectUuid2,
        );
        expect(matchingAccesses.length).toBe(2);
        for (const access of matchingAccesses) {
            expect(access.rights).toBe(AccessGroupRights.DELETE);
        }
    });

    describe('granting the internal _ADMIN rights', () => {
        test('a WRITE user cannot add themselves with _ADMIN rights', async () => {
            const { writer, writerGroup, projectUuid } = await setupWriteUser();

            const headers = new HeaderCreator(writer);
            headers.addHeader('Content-Type', 'application/json');
            const response = await fetch(
                `${DEFAULT_URL}/projects/${projectUuid}/users`,
                {
                    method: 'POST',
                    headers: headers.getHeaders(),
                    body: JSON.stringify({
                        userUuid: writer.uuid,
                        rights: AccessGroupRights._ADMIN,
                    }),
                },
            );

            expect(response.status).toBe(400);
            await expectWriterStillHasWrite(writerGroup, projectUuid);
        });

        test('a WRITE user cannot add their group with _ADMIN rights', async () => {
            const { writer, writerGroup, projectUuid } = await setupWriteUser();

            const headers = new HeaderCreator(writer);
            headers.addHeader('Content-Type', 'application/json');
            const response = await fetch(
                `${DEFAULT_URL}/access-groups/${writerGroup.uuid}/projects/${projectUuid}`,
                {
                    method: 'POST',
                    headers: headers.getHeaders(),
                    body: JSON.stringify({
                        rights: AccessGroupRights._ADMIN,
                    }),
                },
            );

            expect(response.status).toBe(400);
            await expectWriterStillHasWrite(writerGroup, projectUuid);
        });

        test('the project owner cannot set _ADMIN rights through the bulk update', async () => {
            const { creator, writerGroup, projectUuid } =
                await setupWriteUser();

            const headers = new HeaderCreator(creator);
            headers.addHeader('Content-Type', 'application/json');
            const response = await fetch(
                `${DEFAULT_URL}/projects/${projectUuid}/access`,
                {
                    method: 'POST',
                    headers: headers.getHeaders(),
                    body: JSON.stringify([
                        {
                            memberCount: 1,
                            rights: AccessGroupRights._ADMIN,
                            type: writerGroup.type,
                            uuid: writerGroup.uuid,
                            name: writerGroup.name,
                        },
                    ]),
                },
            );

            expect(response.status).toBe(400);
            await expectWriterStillHasWrite(writerGroup, projectUuid);
        });

        test('a project cannot be created with _ADMIN rights for a group', async () => {
            const { user: creator } = await generateAndFetchDatabaseUser(
                'internal',
                'user',
            );
            const { user: otherUser } = await generateAndFetchDatabaseUser(
                'internal',
                'user',
            );
            const otherUserGroup = await database
                .getRepository<AccessGroupEntity>(AccessGroupEntity)
                .findOneOrFail({ where: { name: otherUser.name } });

            const headers = new HeaderCreator(creator);
            headers.addHeader('Content-Type', 'application/json');
            const response = await fetch(`${DEFAULT_URL}/projects`, {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    name: 'admin_rights_project',
                    description: 'Project granting _ADMIN rights',
                    accessGroups: [
                        {
                            rights: AccessGroupRights._ADMIN,
                            accessGroupUUID: otherUserGroup.uuid,
                        },
                    ],
                }),
            });

            expect(response.status).toBe(400);
            const accesses = await database
                .getRepository<ProjectAccessEntity>(ProjectAccessEntity)
                .find({
                    where: { accessGroup: { uuid: otherUserGroup.uuid } },
                });
            expect(accesses).toHaveLength(0);
        });
    });
});
