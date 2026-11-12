import {
    MetadataEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { DataType, UserRole } from '@kleinkram/shared';
import {
    createMetadataTypeUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

const postMetadata = async (
    user: UserEntity,
    missionUuid: string,
    metadata: Record<string, string>,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/missions/${missionUuid}/metadata`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata }),
    });

const getMissionMetadata = async (
    missionUuid: string,
): Promise<MetadataEntity[]> =>
    database.getRepository(MetadataEntity).find({
        where: { mission: { uuid: missionUuid } },
        relations: { mission: true, metadataType: true },
    });

const setup = async (): Promise<{
    user: UserEntity;
    projectUuid: string;
    missionUuid: string;
    linkTypeUuid: string;
    stringTypeUuid: string;
}> => {
    const suffix = String(Date.now());
    const userUuid = await mockDatabaseUser(
        'link-metadata@leggedrobotics.com',
        'Link Metadata User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);

    const linkTypeUuid = await createMetadataTypeUsingPost(
        { type: DataType.LINK, name: `link_${suffix}` },
        user,
    );
    const stringTypeUuid = await createMetadataTypeUsingPost(
        { type: DataType.STRING, name: `string_${suffix}` },
        user,
    );
    const projectUuid = await createProjectUsingPost(
        {
            name: `link_metadata_project_${suffix}`,
            description: 'Test project',
            requiredMetadataTypes: [],
        },
        user,
    );
    const missionUuid = await createMissionUsingPost(
        {
            name: `link_metadata_mission_${suffix}`,
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        user,
    );
    return { user, projectUuid, missionUuid, linkTypeUuid, stringTypeUuid };
};

/**
 * LINK metadata values are opened by the frontend on click, so the API only
 * accepts absolute `http:` and `https:` URLs for them.
 */
describe('Link Metadata Validation', () => {
    setupDatabaseHooks();

    test('should accept an https link', async () => {
        const { user, missionUuid, linkTypeUuid } = await setup();

        const response = await postMetadata(user, missionUuid, {
            [linkTypeUuid]: 'https://example.com/run?id=1',
        });
        expect(response.status).toBeLessThan(300);

        const metadata = await getMissionMetadata(missionUuid);
        expect(metadata.map((entry) => entry.value_string)).toContain(
            'https://example.com/run?id=1',
        );
    });

    test.each([
        'javascript:alert(document.cookie)',
        ' JavaScript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'example.com',
        '//example.com',
    ])('should reject the link %p with 422', async (link) => {
        const { user, missionUuid, linkTypeUuid } = await setup();

        const response = await postMetadata(user, missionUuid, {
            [linkTypeUuid]: link,
        });
        expect(response.status).toBe(422);
        expect(await getMissionMetadata(missionUuid)).toHaveLength(0);
    });

    test('should reject an unsafe link when updating an existing value', async () => {
        const { user, missionUuid, linkTypeUuid } = await setup();
        const seeded = await postMetadata(user, missionUuid, {
            [linkTypeUuid]: 'https://example.com',
        });
        expect(seeded.status).toBeLessThan(300);

        const response = await postMetadata(user, missionUuid, {
            [linkTypeUuid]: 'javascript:alert(1)',
        });
        expect(response.status).toBe(422);

        const metadata = await getMissionMetadata(missionUuid);
        expect(metadata.map((entry) => entry.value_string)).toEqual([
            'https://example.com',
        ]);
    });

    test('should not remove other metadata if a link in the same request is rejected', async () => {
        const { user, missionUuid, linkTypeUuid, stringTypeUuid } =
            await setup();
        const seeded = await postMetadata(user, missionUuid, {
            [stringTypeUuid]: 'keep me',
        });
        expect(seeded.status).toBeLessThan(300);

        // Omitting the string type would normally delete it.
        const response = await postMetadata(user, missionUuid, {
            [linkTypeUuid]: 'javascript:alert(1)',
        });
        expect(response.status).toBe(422);

        const metadata = await getMissionMetadata(missionUuid);
        expect(metadata.map((entry) => entry.value_string)).toEqual([
            'keep me',
        ]);
    });

    test('should not create a mission if its link metadata is rejected', async () => {
        const { user, projectUuid, linkTypeUuid } = await setup();
        const name = `link_metadata_rejected_${String(Date.now())}`;

        const response = await fetch(`${DEFAULT_URL}/missions`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(user),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                projectUUID: projectUuid,
                metadata: { [linkTypeUuid]: 'javascript:alert(1)' },
                ignoreMissingMetadata: true,
            }),
        });
        expect(response.status).toBe(422);

        const missions = await database
            .getRepository(MissionEntity)
            .find({ where: { name } });
        expect(missions).toHaveLength(0);
    });

    test('should not validate string metadata as a link', async () => {
        const { user, missionUuid, stringTypeUuid } = await setup();

        const response = await postMetadata(user, missionUuid, {
            [stringTypeUuid]: 'javascript:alert(1)',
        });
        expect(response.status).toBeLessThan(300);
    });
});
