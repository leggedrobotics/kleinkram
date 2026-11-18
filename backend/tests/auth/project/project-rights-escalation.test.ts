import {
    AccessGroupEntity,
    ProjectAccessEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { createProjectUsingPost, HeaderCreator } from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

const post = async (
    user: UserEntity,
    path: string,
    body: unknown,
): Promise<number> => {
    const headers = new HeaderCreator(user);
    headers.addHeader('Content-Type', 'application/json');
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method: 'POST',
        headers: headers.getHeaders(),
        body: JSON.stringify(body),
    });
    return response.status;
};

const personalGroupOf = async (user: UserEntity): Promise<AccessGroupEntity> =>
    database.getRepository(AccessGroupEntity).findOneOrFail({
        where: {
            type: AccessGroupType.PRIMARY,
            memberships: { user: { uuid: user.uuid } },
        },
    });

const rightsOf = async (
    projectUuid: string,
    accessGroupUuid: string,
): Promise<AccessGroupRights> => {
    const access = await database
        .getRepository(ProjectAccessEntity)
        .findOneOrFail({
            where: {
                project: { uuid: projectUuid },
                accessGroup: { uuid: accessGroupUuid },
            },
        });
    return access.rights;
};

/** A project owned by one user, with a second user holding WRITE rights. */
const setup = async (): Promise<{
    writer: UserEntity;
    writerGroup: AccessGroupEntity;
    projectUuid: string;
}> => {
    const { user: owner } = await generateAndFetchDatabaseUser(
        'internal',
        'user',
    );
    const { user: writer } = await generateAndFetchDatabaseUser(
        'external',
        'user',
    );
    const projectUuid = await createProjectUsingPost(
        {
            name: 'rights_escalation_project',
            description: 'Project for the rights escalation tests',
            accessGroups: [
                { userUuid: writer.uuid, rights: AccessGroupRights.WRITE },
            ],
        },
        owner,
    );
    const writerGroup = await personalGroupOf(writer);
    expect(await rightsOf(projectUuid, writerGroup.uuid)).toBe(
        AccessGroupRights.WRITE,
    );
    return { writer, writerGroup, projectUuid };
};

/**
 * A user with WRITE rights on a project must not be able to raise their own
 * rights, neither to DELETE nor to the internal `_ADMIN` value (100), which
 * would rank above DELETE in every rights check.
 */
describe('Project Rights Escalation', () => {
    setupDatabaseHooks();

    test('should reject a writer granting themselves _ADMIN through the add user endpoint', async () => {
        const { writer, writerGroup, projectUuid } = await setup();

        expect(
            await post(writer, `/projects/${projectUuid}/users`, {
                userUuid: writer.uuid,
                rights: AccessGroupRights._ADMIN,
            }),
        ).toBe(400);
        expect(await rightsOf(projectUuid, writerGroup.uuid)).toBe(
            AccessGroupRights.WRITE,
        );
    });

    test('should reject a writer granting their group _ADMIN through the add access group endpoint', async () => {
        const { writer, writerGroup, projectUuid } = await setup();

        expect(
            await post(
                writer,
                `/access-groups/${writerGroup.uuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights._ADMIN },
            ),
        ).toBe(400);
        expect(await rightsOf(projectUuid, writerGroup.uuid)).toBe(
            AccessGroupRights.WRITE,
        );
    });

    test('should reject a writer granting _ADMIN through the update access endpoint', async () => {
        const { writer, writerGroup, projectUuid } = await setup();

        expect(
            await post(writer, `/projects/${projectUuid}/access`, [
                {
                    uuid: writerGroup.uuid,
                    name: writerGroup.name,
                    type: AccessGroupType.PRIMARY,
                    memberCount: 1,
                    rights: AccessGroupRights._ADMIN,
                },
            ]),
        ).toBe(400);
        expect(await rightsOf(projectUuid, writerGroup.uuid)).toBe(
            AccessGroupRights.WRITE,
        );
    });

    test('should reject a writer granting themselves DELETE through either add endpoint', async () => {
        const { writer, writerGroup, projectUuid } = await setup();

        expect(
            await post(writer, `/projects/${projectUuid}/users`, {
                userUuid: writer.uuid,
                rights: AccessGroupRights.DELETE,
            }),
        ).toBe(409);
        expect(
            await post(
                writer,
                `/access-groups/${writerGroup.uuid}/projects/${projectUuid}`,
                { rights: AccessGroupRights.DELETE },
            ),
        ).toBe(409);
        expect(await rightsOf(projectUuid, writerGroup.uuid)).toBe(
            AccessGroupRights.WRITE,
        );
    });

    test('should reject creating a project that grants _ADMIN', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: other } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        expect(
            await post(creator, '/projects', {
                name: 'admin_rights_project',
                description: 'Must not be created',
                accessGroups: [
                    { userUuid: other.uuid, rights: AccessGroupRights._ADMIN },
                ],
            }),
        ).toBe(400);
    });
});
