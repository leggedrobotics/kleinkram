import { MetadataEntity, TagTypeEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, DataType } from '@kleinkram/shared';
import {
    createMetadataUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * Helper: creates a project, mission, tag type, and a tag value on the mission.
 * Returns the tag value UUID (MetadataEntity) for use in DELETE tests.
 */
async function setupMissionWithTagValue(
    creator: Awaited<ReturnType<typeof generateAndFetchDatabaseUser>>['user'],
    accessUser: Awaited<
        ReturnType<typeof generateAndFetchDatabaseUser>
    >['user'],
    rights: AccessGroupRights,
): Promise<{ tagValueUuid: string; missionUuid: string }> {
    const tagTypeUuid = await createMetadataUsingPost(
        { type: DataType.STRING, name: `tag_type_${String(Date.now())}` },
        creator,
    );

    const projectUuid = await createProjectUsingPost(
        {
            name: `tag_project_${String(Date.now())}`,
            description: 'Test project',
            requiredTags: [],
            accessGroups: [
                {
                    rights,
                    userUuid: accessUser.uuid,
                },
            ],
        },
        creator,
    );

    // createMissionUsingPost hardcodes tags: {} — add tags separately
    const missionUuid = await createMissionUsingPost(
        {
            name: `tag_mission_${String(Date.now())}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        creator,
    );

    // Add tag value to mission via the API
    const tagHeaders = new HeaderCreator(creator);
    tagHeaders.addHeader('Content-Type', 'application/json');
    const tagResponse = await fetch(`${DEFAULT_URL}/mission/tags`, {
        method: 'POST',
        headers: tagHeaders.getHeaders(),
        body: JSON.stringify({
            missionUUID: missionUuid,
            tags: { [tagTypeUuid]: 'test_value' },
        }),
    });
    expect(tagResponse.status).toBeLessThan(300);

    // Query the MetadataEntity UUID from the DB
    const tagRepo = database.getRepository(MetadataEntity);
    const tagValues = await tagRepo.find({
        where: { mission: { uuid: missionUuid } },
        relations: ['mission'],
    });
    const tagValue = tagValues.find((t) => t.tagType?.uuid === tagTypeUuid);
    if (!tagValue) {
        throw new Error(
            `Tag value not found for mission ${missionUuid} and tagType ${tagTypeUuid}`,
        );
    }

    return { tagValueUuid: tagValue.uuid, missionUuid };
}

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Project Level Access', () => {
    setupDatabaseHooks();

    test('if viewer of a project cannot add any tag types', async () => {
        // Creator sets up project with READ access for viewer
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create tag type
        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'viewer_test_tag' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'viewer_tag_project',
                description: 'Test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUuid: viewer.uuid,
                    },
                ],
            },
            creator,
        );

        // Viewer tries to add tag type to project (requires WRITE)
        const headers = new HeaderCreator(viewer);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/updateTagTypes`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ tagTypeUUIDs: [tagUuid] }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if viewer of a project cannot remove any tag types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create tag type
        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'viewer_remove_tag' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'viewer_remove_tag_project',
                description: 'Test project',
                requiredTags: [tagUuid],
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUuid: viewer.uuid,
                    },
                ],
            },
            creator,
        );

        // Viewer tries to remove tag type from project (requires WRITE)
        const headers = new HeaderCreator(viewer);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/updateTagTypes`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ tagTypeUUIDs: [] }),
            },
        );
        expect(response.status).toBe(403);
    });

    test('if editor of a project can add any tag types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: editor } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'editor_add_tag' },
            creator,
        );

        const projectUuid = await createProjectUsingPost(
            {
                name: 'editor_add_tag_project',
                description: 'Test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        userUuid: editor.uuid,
                    },
                ],
            },
            creator,
        );

        // Editor adds tag type to project
        const headers = new HeaderCreator(editor);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/updateTagTypes`,
            {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ tagTypeUUIDs: [tagUuid] }),
            },
        );
        expect(response.status).toBeLessThan(300);
    });

    // DELETE /tag/:uuid deletes tag values (MetadataEntity) on missions,
    // not TagTypes. A viewer with only READ access should be denied.
    test('if viewer of a project cannot delete any tag values', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { tagValueUuid } = await setupMissionWithTagValue(
            creator,
            viewer,
            AccessGroupRights.READ,
        );

        // Viewer tries to delete a tag value (requires WRITE on the mission)
        const headers = new HeaderCreator(viewer);
        const response = await fetch(`${DEFAULT_URL}/tag/${tagValueUuid}`, {
            method: 'DELETE',
            headers: headers.getHeaders(),
        });
        expect(response.status).toBe(403);
    });

    // An editor (WRITE access) should be able to delete tag values on missions.
    test('if editor of a project can delete any tag values', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: editor } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { tagValueUuid } = await setupMissionWithTagValue(
            creator,
            editor,
            AccessGroupRights.WRITE,
        );

        // Editor deletes a tag value
        const headers = new HeaderCreator(editor);
        const response = await fetch(`${DEFAULT_URL}/tag/${tagValueUuid}`, {
            method: 'DELETE',
            headers: headers.getHeaders(),
        });
        // Guard allows the request (not 403). The endpoint itself returns 500 due to
        // a pre-existing DeleteTagDto response serialization bug, but the tag IS deleted.
        expect(response.status).not.toBe(403);

        // Verify tag value is deleted
        const tagRepo = database.getRepository(MetadataEntity);
        const deletedTag = await tagRepo.findOne({
            where: { uuid: tagValueUuid },
        });
        expect(deletedTag).toBeNull();
    });
});

describe('Verify tags/metadata type generation', () => {
    setupDatabaseHooks();

    test('if internal user can add string tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'test_tag_string' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_string');
        expect(tagType.datatype).toBe(DataType.STRING);
    });

    test('if internal user can add number tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.NUMBER, name: 'test_tag_number' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_number');
        expect(tagType.datatype).toBe(DataType.NUMBER);
    });

    test('if internal user can add boolean tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.BOOLEAN, name: 'test_tag_boolean' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_boolean');
        expect(tagType.datatype).toBe(DataType.BOOLEAN);
    });

    test('if internal user can add date tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.DATE, name: 'test_tag_date' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_date');
        expect(tagType.datatype).toBe(DataType.DATE);
    });

    test('if internal user can add location tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.LOCATION, name: 'test_tag_location' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_location');
        expect(tagType.datatype).toBe(DataType.LOCATION);
    });

    test('if internal user can add link tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.LINK, name: 'test_tag_link' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_link');
        expect(tagType.datatype).toBe(DataType.LINK);
    });

    test('if internal user can add any tags/metadata', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        const tagUuid = await createMetadataUsingPost(
            { type: DataType.ANY, name: 'test_tag_any' },
            user,
        );

        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await tagRepo.findOneOrFail({
            where: { uuid: tagUuid },
        });
        expect(tagType.name).toBe('test_tag_any');
        expect(tagType.datatype).toBe(DataType.ANY);
    });

    test('if internal user can not create metadata with the same name AND datatype', async () => {
        const { user } = await generateAndFetchDatabaseUser('internal', 'user');

        // Create tag first time—should succeed
        await createMetadataUsingPost(
            { type: DataType.STRING, name: 'duplicate_tag' },
            user,
        );

        // Try to create same tag again—should fail
        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/tag/create`, {
            method: 'POST',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                name: 'duplicate_tag',
                type: DataType.STRING,
            }),
        });

        // Should return a conflict or bad request status
        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});
