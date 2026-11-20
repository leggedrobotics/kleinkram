import { MissionEntity, UserEntity } from '@kleinkram/backend-common';
import { DataType, UserRole } from '@kleinkram/shared';
import {
    createMetadataTypeUsingPost,
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
    projectUuid: string;
    requiredTypeUuid: string;
}

const postMission = async (
    user: UserEntity,
    body: Record<string, unknown>,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}/missions`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

const missionExists = async (name: string): Promise<boolean> =>
    (await database.getRepository(MissionEntity).count({ where: { name } })) >
    0;

const setup = async (): Promise<Fixture> => {
    const suffix = String(Date.now());
    const userUuid = await mockDatabaseUser(
        'required-metadata@leggedrobotics.com',
        'Required Metadata User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);

    const requiredTypeUuid = await createMetadataTypeUsingPost(
        { type: DataType.STRING, name: `required_${suffix}` },
        user,
    );
    const projectUuid = await createProjectUsingPost(
        {
            name: `required_metadata_project_${suffix}`,
            description: 'Test project',
            requiredMetadataTypes: [requiredTypeUuid],
        },
        user,
    );

    return { user, projectUuid, requiredTypeUuid };
};

/**
 * `POST /missions` refuses a mission that lacks metadata its project
 * requires, unless the caller passes `ignoreMissingMetadata`.
 */
describe('Required metadata on mission creation', () => {
    setupDatabaseHooks();

    test('a mission without the required metadata is refused', async () => {
        const { user, projectUuid } = await setup();

        const response = await postMission(user, {
            name: 'missing_required',
            projectUUID: projectUuid,
            metadata: {},
        });

        expect(response.status).toBe(409);
        expect(await missionExists('missing_required')).toBe(false);
    });

    test('an empty value counts as missing', async () => {
        const { user, projectUuid, requiredTypeUuid } = await setup();

        const response = await postMission(user, {
            name: 'empty_required',
            projectUUID: projectUuid,
            metadata: { [requiredTypeUuid]: '' },
        });

        expect(response.status).toBe(409);
    });

    test('a mission with the required metadata is created', async () => {
        const { user, projectUuid, requiredTypeUuid } = await setup();

        const response = await postMission(user, {
            name: 'with_required',
            projectUUID: projectUuid,
            metadata: { [requiredTypeUuid]: 'anymal' },
        });

        expect(response.status).toBeLessThan(300);
        expect(await missionExists('with_required')).toBe(true);
    });

    test('ignoreMissingMetadata creates the mission anyway', async () => {
        const { user, projectUuid } = await setup();

        const response = await postMission(user, {
            name: 'ignored_required',
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        });

        expect(response.status).toBeLessThan(300);
        expect(await missionExists('ignored_required')).toBe(true);
    });
});
