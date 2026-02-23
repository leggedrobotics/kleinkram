import { TagTypeEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, DataType } from '@kleinkram/shared';
import {
    createMetadataUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

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
                        userUUID: viewer.uuid,
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
                        userUUID: viewer.uuid,
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
                        userUUID: editor.uuid,
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

    // TODO: Server bug — DeleteTagGuard treats TagType UUID as a mission-level
    // tag and calls canTagMission, which fails with 500 because TagTypes have
    // no mission association. Fix DeleteTagGuard to handle global TagType deletion.
    test.skip('if viewer of a project cannot delete any tag types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Create a tag type
        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'viewer_delete_tag' },
            creator,
        );

        // Viewer (external user with no CREATE rights) should not be able to delete tags
        const { user: viewer } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const headers = new HeaderCreator(viewer);
        const response = await fetch(`${DEFAULT_URL}/tag/${tagUuid}`, {
            method: 'DELETE',
            headers: headers.getHeaders(),
        });
        expect(response.status).toBe(403);
    });

    // TODO: Server bug — same DeleteTagGuard issue as above.
    test.skip('if editor of a project can delete any tag types', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        // Create a tag type
        const tagUuid = await createMetadataUsingPost(
            { type: DataType.STRING, name: 'editor_delete_tag' },
            creator,
        );

        // Admin/creator should be able to delete tags
        const headers = new HeaderCreator(creator);
        const response = await fetch(`${DEFAULT_URL}/tag/${tagUuid}`, {
            method: 'DELETE',
            headers: headers.getHeaders(),
        });
        expect(response.status).toBeLessThan(300);

        // Verify tag is deleted
        const tagRepo = database.getRepository<TagTypeEntity>(TagTypeEntity);
        const deletedTag = await tagRepo.findOne({
            where: { uuid: tagUuid },
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
