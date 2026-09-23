import { MetadataEntity, UserEntity } from '@kleinkram/backend-common';
import { DataType, UserRole } from '@kleinkram/shared';
import {
    createMetadataUsingPost,
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

interface Fixture {
    user: UserEntity;
    missionUuid: string;
    requiredTypeUuid: string;
    optionalTypeUuid: string;
}

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

const getMissionTagTypeUuids = async (
    missionUuid: string,
): Promise<string[]> => {
    const tags = await database.getRepository(MetadataEntity).find({
        where: { mission: { uuid: missionUuid } },
        relations: { mission: true, tagType: true },
    });
    return tags.map((tag) => tag.tagType?.uuid ?? '');
};

const setup = async (): Promise<Fixture> => {
    const suffix = String(Date.now());
    const userUuid = await mockDatabaseUser(
        'metadata-replace@kleinkram.dev',
        'Metadata Replace User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);

    const requiredTypeUuid = await createMetadataUsingPost(
        { type: DataType.STRING, name: `required_${suffix}` },
        user,
    );
    const optionalTypeUuid = await createMetadataUsingPost(
        { type: DataType.STRING, name: `optional_${suffix}` },
        user,
    );

    const projectUuid = await createProjectUsingPost(
        {
            name: `metadata_replace_project_${suffix}`,
            description: 'Test project',
            requiredTags: [requiredTypeUuid],
        },
        user,
    );

    const missionUuid = await createMissionUsingPost(
        {
            name: `metadata_replace_mission_${suffix}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        user,
    );

    // seed both metadata values
    const seeded = await postMetadata(user, missionUuid, {
        [requiredTypeUuid]: 'required_value',
        [optionalTypeUuid]: 'optional_value',
    });
    expect(seeded.status).toBeLessThan(300);

    return { user, missionUuid, requiredTypeUuid, optionalTypeUuid };
};

/**
 * `POST /missions/:uuid/metadata` replaces the mission's full metadata set:
 * metadata whose type is absent from the payload is removed. Metadata types
 * the project marks as required are the exception — dropping one of those is
 * rejected rather than silently applied.
 */
describe('Mission metadata full replace', () => {
    setupDatabaseHooks();

    test('a metadata type that is not required is removed when omitted', async () => {
        const { user, missionUuid, requiredTypeUuid, optionalTypeUuid } =
            await setup();

        const response = await postMetadata(user, missionUuid, {
            [requiredTypeUuid]: 'required_value',
        });
        expect(response.status).toBeLessThan(300);

        const tagTypeUuids = await getMissionTagTypeUuids(missionUuid);
        expect(tagTypeUuids).toContain(requiredTypeUuid);
        expect(tagTypeUuids).not.toContain(optionalTypeUuid);
    });

    test('a required metadata type cannot be removed', async () => {
        const { user, missionUuid, requiredTypeUuid, optionalTypeUuid } =
            await setup();

        const response = await postMetadata(user, missionUuid, {
            [optionalTypeUuid]: 'optional_value',
        });
        expect(response.status).toBe(400);

        // nothing was applied
        const tagTypeUuids = await getMissionTagTypeUuids(missionUuid);
        expect(tagTypeUuids).toContain(requiredTypeUuid);
        expect(tagTypeUuids).toContain(optionalTypeUuid);
    });

    test('a required metadata type can still be updated', async () => {
        const { user, missionUuid, requiredTypeUuid, optionalTypeUuid } =
            await setup();

        const response = await postMetadata(user, missionUuid, {
            [requiredTypeUuid]: 'new_required_value',
            [optionalTypeUuid]: 'optional_value',
        });
        expect(response.status).toBeLessThan(300);

        const tags = await database.getRepository(MetadataEntity).find({
            where: { mission: { uuid: missionUuid } },
            relations: { mission: true, tagType: true },
        });
        const required = tags.find(
            (tag) => tag.tagType?.uuid === requiredTypeUuid,
        );
        expect(required?.value_string).toBe('new_required_value');
    });
});
