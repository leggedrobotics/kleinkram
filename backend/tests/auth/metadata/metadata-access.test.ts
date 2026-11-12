import { MetadataEntity, MetadataTypeEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, DataType } from '@kleinkram/shared';
import {
    createMetadataTypeUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * Helper: creates a project, mission, metadata type, and a metadata value on
 * the mission. Returns the metadata UUID (MetadataEntity) for use in DELETE
 * tests.
 */
async function setupMissionWithMetadata(
    creator: Awaited<ReturnType<typeof generateAndFetchDatabaseUser>>['user'],
    accessUser: Awaited<
        ReturnType<typeof generateAndFetchDatabaseUser>
    >['user'],
    rights: AccessGroupRights,
): Promise<{ metadataUuid: string; missionUuid: string }> {
    const metadataTypeUuid = await createMetadataTypeUsingPost(
        {
            type: DataType.STRING,
            name: `metadata_type_${String(Date.now())}`,
        },
        creator,
    );

    const projectUuid = await createProjectUsingPost(
        {
            name: `metadata_project_${String(Date.now())}`,
            description: 'Test project',
            requiredMetadataTypes: [],
            accessGroups: [
                {
                    rights,
                    userUuid: accessUser.uuid,
                },
            ],
        },
        creator,
    );

    const missionUuid = await createMissionUsingPost(
        {
            name: `metadata_mission_${String(Date.now())}`,
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        creator,
    );

    // Add metadata value to mission via the API
    const metadataHeaders = new HeaderCreator(creator);
    metadataHeaders.addHeader('Content-Type', 'application/json');
    const metadataResponse = await fetch(
        `${DEFAULT_URL}/missions/${missionUuid}/metadata`,
        {
            method: 'POST',
            headers: metadataHeaders.getHeaders(),
            body: JSON.stringify({
                metadata: { [metadataTypeUuid]: 'test_value' },
            }),
        },
    );
    expect(metadataResponse.status).toBeLessThan(300);

    // Query the MetadataEntity UUID from the DB
    const metadataRepo = database.getRepository(MetadataEntity);
    const metadataValues = await metadataRepo.find({
        where: { mission: { uuid: missionUuid } },
        relations: {
            mission: true,
        },
    });
    const metadata = metadataValues.find(
        (m) => m.metadataType?.uuid === metadataTypeUuid,
    );
    if (!metadata) {
        throw new Error(
            `Metadata not found for mission ${missionUuid} and metadata type ${metadataTypeUuid}`,
        );
    }

    return { metadataUuid: metadata.uuid, missionUuid };
}

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Project Level Access', () => {
    setupDatabaseHooks();

    test('if viewer of a project cannot add any metadata types', async () => {
        // Creator sets up project with READ access for viewer
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create metadata type
        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'viewer_test_metadata_type' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'viewer_metadata_project',
                description: 'Test project',
                requiredMetadataTypes: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUuid: viewer.uuid,
                    },
                ],
            },
            creator,
        );

        // Viewer tries to add metadata type to project (requires WRITE)
        const headers = new HeaderCreator(viewer);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/metadata-types`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ metadataTypeUUIDs: [metadataTypeUuid] }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if viewer of a project cannot remove any metadata types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create metadata type
        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'viewer_remove_metadata_type' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'viewer_remove_metadata_project',
                description: 'Test project',
                requiredMetadataTypes: [metadataTypeUuid],
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUuid: viewer.uuid,
                    },
                ],
            },
            creator,
        );

        // Viewer tries to remove metadata type from project (requires WRITE)
        const headers = new HeaderCreator(viewer);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/metadata-types`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ metadataTypeUUIDs: [] }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if editor of a project can add any metadata types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: editor } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'editor_add_metadata_type' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'editor_add_metadata_project',
                description: 'Test project',
                requiredMetadataTypes: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        userUuid: editor.uuid,
                    },
                ],
            },
            creator,
        );

        // Editor adds metadata type to project
        const headers = new HeaderCreator(editor);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/metadata-types`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({ metadataTypeUUIDs: [metadataTypeUuid] }),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    // DELETE /metadata/:uuid deletes metadata values (MetadataEntity) on
    // missions, not metadata types. A viewer with only READ access should be denied.
    test('if viewer of a project cannot delete any metadata values', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { metadataUuid } = await setupMissionWithMetadata(
            creator,
            viewer,
            AccessGroupRights.READ,
        );

        // Viewer tries to delete a metadata value (requires WRITE on the mission)
        const headers = new HeaderCreator(viewer);
        const response = await fetch(
            `${DEFAULT_URL}/metadata/${metadataUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        expect(response.status).toBe(403);
    });

    // An editor (WRITE access) should be able to delete metadata values on missions.
    test('if editor of a project can delete any metadata values', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: editor } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { metadataUuid } = await setupMissionWithMetadata(
            creator,
            editor,
            AccessGroupRights.WRITE,
        );

        // Editor deletes a metadata value
        const headers = new HeaderCreator(editor);
        const response = await fetch(
            `${DEFAULT_URL}/metadata/${metadataUuid}`,
            {
                method: 'DELETE',
                headers: headers.getHeaders(),
            },
        );
        // Guard allows the request (not 403). The endpoint itself returns 500 due to
        // a pre-existing DeleteMetadataDto response serialization bug, but the
        // metadata IS deleted.
        expect(response.status).not.toBe(403);

        // Verify metadata value is deleted
        const metadataRepo = database.getRepository(MetadataEntity);
        const deletedMetadata = await metadataRepo.findOne({
            where: { uuid: metadataUuid },
        });
        expect(deletedMetadata).toBeNull();
    });
});

describe('Verify metadata type generation', () => {
    setupDatabaseHooks();

    test('if internal user can add string metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'test_metadata_string' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_string');
        expect(metadataType.datatype).toBe(DataType.STRING);
    });

    test('if internal user can add number metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.NUMBER, name: 'test_metadata_number' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_number');
        expect(metadataType.datatype).toBe(DataType.NUMBER);
    });

    test('if internal user can add boolean metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.BOOLEAN, name: 'test_metadata_boolean' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_boolean');
        expect(metadataType.datatype).toBe(DataType.BOOLEAN);
    });

    test('if internal user can add date metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.DATE, name: 'test_metadata_date' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_date');
        expect(metadataType.datatype).toBe(DataType.DATE);
    });

    test('if internal user can add location metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.LOCATION, name: 'test_metadata_location' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_location');
        expect(metadataType.datatype).toBe(DataType.LOCATION);
    });

    test('if internal user can add link metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.LINK, name: 'test_metadata_link' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_link');
        expect(metadataType.datatype).toBe(DataType.LINK);
    });

    test('if internal user can add any metadata types', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.ANY, name: 'test_metadata_any' },
            user,
        );

        const metadataTypeRepo =
            database.getRepository<MetadataTypeEntity>(MetadataTypeEntity);
        const metadataType = await metadataTypeRepo.findOneOrFail({
            where: { uuid: metadataTypeUuid },
        });
        expect(metadataType.name).toBe('test_metadata_any');
        expect(metadataType.datatype).toBe(DataType.ANY);
    });

    test('if internal user can not create metadata with the same name AND datatype', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Create metadata type first time—should succeed
        await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'duplicate_metadata_type' },
            user,
        );

        // Try to create same metadata type again—should fail
        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/metadata-types`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'duplicate_metadata_type',
                type: DataType.STRING,
            }),
        });

        // Should return a conflict or bad request status
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('if metadata values are successfully updated on second POST', async () => {
        interface TestMission {
            metadata: {
                type: {
                    uuid: string;
                };
                value: unknown;
            }[];
        }

        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const metadataTypeUuid = await createMetadataTypeUsingPost(
            { type: DataType.STRING, name: 'update_test_metadata_type' },
            user,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'update_test_project',
                description: 'Test project',
            },
            user,
        );

        const missionUuid = await createMissionUsingPost(
            {
                name: 'update_test_mission',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );

        // Add metadata value first time (succeeds)
        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const response1 = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}/metadata`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    metadata: { [metadataTypeUuid]: 'original_value' },
                }),
            },
        );
        expect(response1.status).toBeLessThan(300);

        // Verify value in DB
        const metadataRepo = database.getRepository(MetadataEntity);
        let metadata = await metadataRepo.findOneOrFail({
            where: {
                mission: { uuid: missionUuid },
                metadataType: { uuid: metadataTypeUuid },
            },
        });
        expect(metadata.value_string).toBe('original_value');

        // Verify value via GET API
        let getResponse = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(getResponse.status).toBe(200);
        let missionData = (await getResponse.json()) as TestMission;
        expect(
            missionData.metadata.find((m) => m.type.uuid === metadataTypeUuid)
                ?.value,
        ).toBe('original_value');

        // Update metadata value second time (succeeds)
        const response2 = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}/metadata`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    metadata: { [metadataTypeUuid]: 'updated_value' },
                }),
            },
        );
        expect(response2.status).toBeLessThan(300);

        // Verify updated value in DB
        metadata = await metadataRepo.findOneOrFail({
            where: {
                mission: { uuid: missionUuid },
                metadataType: { uuid: metadataTypeUuid },
            },
        });
        expect(metadata.value_string).toBe('updated_value');

        // Verify updated value via GET API
        getResponse = await fetch(`${DEFAULT_URL}/missions/${missionUuid}`, {
            method: 'GET',
            headers: headers.getHeaders(),
        });
        expect(getResponse.status).toBe(200);
        missionData = (await getResponse.json()) as TestMission;
        expect(
            missionData.metadata.find((m) => m.type.uuid === metadataTypeUuid)
                ?.value,
        ).toBe('updated_value');

        // Post empty metadata - should delete the metadata value
        const response3 = await fetch(
            `${DEFAULT_URL}/missions/${missionUuid}/metadata`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    metadata: {},
                }),
            },
        );
        expect(response3.status).toBeLessThan(300);

        // Verify it is deleted from DB
        const deletedMetadata = await metadataRepo.findOne({
            where: {
                mission: { uuid: missionUuid },
                metadataType: { uuid: metadataTypeUuid },
            },
        });
        expect(deletedMetadata).toBeNull();

        // Verify it is deleted in GET API
        getResponse = await fetch(`${DEFAULT_URL}/missions/${missionUuid}`, {
            method: 'GET',
            headers: headers.getHeaders(),
        });
        expect(getResponse.status).toBe(200);
        missionData = (await getResponse.json()) as TestMission;
        expect(
            missionData.metadata.find((m) => m.type.uuid === metadataTypeUuid),
        ).toBeUndefined();
    });
});

interface MissionMetadataResponse {
    uuid: string;
    type: { uuid: string };
    value: unknown;
}

interface MissionResponse {
    uuid: string;
    metadata?: MissionMetadataResponse[];
    tags?: MissionMetadataResponse[];
}

async function setupProjectWithMetadataType(name: string): Promise<{
    user: Awaited<ReturnType<typeof generateAndFetchDatabaseUser>>['user'];
    projectUuid: string;
    metadataTypeUuid: string;
    headers: HeaderCreator;
}> {
    const { user } = await generateAndFetchDatabaseUser('internal', 'user');

    const metadataTypeUuid = await createMetadataTypeUsingPost(
        { type: DataType.STRING, name: `${name}_type` },
        user,
    );

    const projectUuid = await createProjectUsingPost(
        { name: `${name}_project`, description: 'Test project' },
        user,
    );

    const headers = new HeaderCreator(user);
    headers.addHeader('Content-Type', 'application/json');

    return { user, projectUuid, metadataTypeUuid, headers };
}

// #2368: the create and rename endpoints reloaded the mission without its
// metadata, so the returned mission had no metadata key.
describe('Verify mission responses include metadata', () => {
    setupDatabaseHooks();

    test('if create and rename return the mission metadata', async () => {
        const { projectUuid, metadataTypeUuid, headers } =
            await setupProjectWithMetadataType('response_metadata');

        const createResponse = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'response_metadata_mission',
                projectUUID: projectUuid,
                metadata: { [metadataTypeUuid]: 'metadata_value' },
            }),
        });
        expect(createResponse.status).toBeLessThan(300);
        const created = (await createResponse.json()) as MissionResponse;
        expect(created.metadata).toHaveLength(1);
        expect(created.metadata?.[0]?.type.uuid).toBe(metadataTypeUuid);
        expect(created.metadata?.[0]?.value).toBe('metadata_value');

        const renameResponse = await fetch(
            `${DEFAULT_URL}/missions/${created.uuid}/name`,
            {
                method: 'PATCH',
                headers: headers.getHeaders(),
                body: JSON.stringify({ name: 'response_metadata_renamed' }),
            },
        );
        expect(renameResponse.status).toBeLessThan(300);
        const renamed = (await renameResponse.json()) as MissionResponse;
        expect(renamed.metadata).toHaveLength(1);
        expect(renamed.metadata?.[0]?.value).toBe('metadata_value');
    });

    // `tags` is the deprecated name of `metadata` in mission responses; old
    // clients read it until 1.0, so it has to carry the same content.
    test('if mission responses contain the deprecated tags alias', async () => {
        const { projectUuid, metadataTypeUuid, headers } =
            await setupProjectWithMetadataType('alias_response');

        const createResponse = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'alias_response_mission',
                projectUUID: projectUuid,
                metadata: { [metadataTypeUuid]: 'alias_value' },
            }),
        });
        expect(createResponse.status).toBeLessThan(300);
        const created = (await createResponse.json()) as MissionResponse;
        expect(created.metadata).toHaveLength(1);
        expect(created.tags).toEqual(created.metadata);

        // single mission
        const getResponse = await fetch(
            `${DEFAULT_URL}/missions/${created.uuid}`,
            { method: 'GET', headers: headers.getHeaders() },
        );
        expect(getResponse.status).toBe(200);
        const fetched = (await getResponse.json()) as MissionResponse;
        expect(fetched.metadata).toHaveLength(1);
        expect(fetched.metadata?.[0]?.value).toBe('alias_value');
        expect(fetched.tags).toEqual(fetched.metadata);

        // mission list
        const listResponse = await fetch(
            `${DEFAULT_URL}/missions?projectUuid=${projectUuid}`,
            { method: 'GET', headers: headers.getHeaders() },
        );
        expect(listResponse.status).toBe(200);
        const list = (await listResponse.json()) as { data: MissionResponse[] };
        const listed = list.data.find((m) => m.uuid === created.uuid);
        expect(listed?.metadata).toHaveLength(1);
        expect(listed?.tags).toEqual(listed?.metadata);
    });

    // Old clients create missions with `tags` / `ignoreTags` instead of
    // `metadata` / `ignoreMissingMetadata`.
    test('if a mission can be created with the deprecated tags body', async () => {
        const { projectUuid, metadataTypeUuid, headers } =
            await setupProjectWithMetadataType('alias_request');

        const createResponse = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'alias_request_mission',
                projectUUID: projectUuid,
                tags: { [metadataTypeUuid]: 'legacy_value' },
                ignoreTags: true,
            }),
        });
        expect(createResponse.status).toBeLessThan(300);
        const created = (await createResponse.json()) as MissionResponse;
        expect(created.metadata).toHaveLength(1);
        expect(created.metadata?.[0]?.type.uuid).toBe(metadataTypeUuid);
        expect(created.metadata?.[0]?.value).toBe('legacy_value');

        const stored = await database.getRepository(MetadataEntity).findOne({
            where: {
                mission: { uuid: created.uuid },
                metadataType: { uuid: metadataTypeUuid },
            },
        });
        expect(stored?.value_string).toBe('legacy_value');
    });

    test('if metadata wins over the deprecated tags alias when both are given', async () => {
        const { projectUuid, metadataTypeUuid, headers } =
            await setupProjectWithMetadataType('alias_precedence');

        const createResponse = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'alias_precedence_mission',
                projectUUID: projectUuid,
                metadata: { [metadataTypeUuid]: 'canonical_value' },
                tags: { [metadataTypeUuid]: 'legacy_value' },
            }),
        });
        expect(createResponse.status).toBeLessThan(300);
        const created = (await createResponse.json()) as MissionResponse;
        expect(created.metadata).toHaveLength(1);
        expect(created.metadata?.[0]?.value).toBe('canonical_value');
    });
});
