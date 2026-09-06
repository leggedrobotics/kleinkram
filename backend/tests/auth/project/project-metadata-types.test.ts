import { UserEntity } from '@kleinkram/backend-common';
import { DataType, UserRole } from '@kleinkram/shared';
import {
    createMetadataUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../../utils/api-calls';
import {
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

const setup = async (): Promise<{
    user: UserEntity;
    projectUuid: string;
    metadataTypeUuid: string;
}> => {
    const userUuid = await mockDatabaseUser(
        'metadata-types@kleinkram.dev',
        'Metadata Types User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);

    const metadataTypeUuid = await createMetadataUsingPost(
        { type: DataType.STRING, name: `mdt_${String(Date.now())}` },
        user,
    );

    const projectUuid = await createProjectUsingPost(
        {
            name: `metadata_types_project_${String(Date.now())}`,
            description: 'Test project',
            requiredTags: [metadataTypeUuid],
        },
        user,
    );

    return { user, projectUuid, metadataTypeUuid };
};

const getRequiredTagUuids = async (
    user: UserEntity,
    projectUuid: string,
): Promise<string[]> => {
    const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
        method: 'GET',
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return json.requiredTags.map((tag: any) => tag.uuid);
};

const putMetadataTypes = async (
    user: UserEntity,
    projectUuid: string,
    body: unknown,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/projects/${projectUuid}/metadata-types`, {
        method: 'PUT',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

/**
 * `PUT /projects/:uuid/metadata-types` replaces the full set of required
 * metadata types. A body that names neither `metadataTypeUUIDs` nor
 * `tagTypeUUIDs` (`{}`, or one that only carries a misspelled key) must be
 * rejected instead of silently clearing the project, and
 * `POST /projects/:uuid/metadata-types` without a type uuid must be a 400
 * rather than a 500.
 */
describe('Project required metadata types', () => {
    setupDatabaseHooks();

    test('PUT with an empty body is rejected and does not clear the project', async () => {
        const { user, projectUuid, metadataTypeUuid } = await setup();

        const response = await putMetadataTypes(user, projectUuid, {});
        expect(response.status).toBe(400);

        expect(await getRequiredTagUuids(user, projectUuid)).toEqual([
            metadataTypeUuid,
        ]);
    });

    test('PUT with only a misspelled key is rejected and does not clear the project', async () => {
        const { user, projectUuid, metadataTypeUuid } = await setup();

        const response = await putMetadataTypes(user, projectUuid, {
            metadataTypeUuids: [metadataTypeUuid],
        });
        expect(response.status).toBe(400);

        expect(await getRequiredTagUuids(user, projectUuid)).toEqual([
            metadataTypeUuid,
        ]);
    });

    test('PUT with an explicit empty array clears the required metadata types', async () => {
        const { user, projectUuid } = await setup();

        const response = await putMetadataTypes(user, projectUuid, {
            metadataTypeUUIDs: [],
        });
        expect(response.status).toBe(200);

        expect(await getRequiredTagUuids(user, projectUuid)).toEqual([]);
    });

    test('PUT still accepts the deprecated tagTypeUUIDs alias', async () => {
        const { user, projectUuid, metadataTypeUuid } = await setup();

        const response = await putMetadataTypes(user, projectUuid, {
            tagTypeUUIDs: [metadataTypeUuid],
        });
        expect(response.status).toBe(200);

        expect(await getRequiredTagUuids(user, projectUuid)).toEqual([
            metadataTypeUuid,
        ]);
    });

    test('PUT rejects values that are not uuids', async () => {
        const { user, projectUuid } = await setup();

        const response = await putMetadataTypes(user, projectUuid, {
            metadataTypeUUIDs: ['not-a-uuid'],
        });
        expect(response.status).toBe(400);
    });

    test('POST without a type uuid is a 400, not a 500', async () => {
        const { user, projectUuid } = await setup();

        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/metadata-types`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(response.status).toBe(400);
    });
});
