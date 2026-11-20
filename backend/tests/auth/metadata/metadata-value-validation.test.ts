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

const send = async (
    user: UserEntity,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; message: unknown }> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const json =
        text === '' ? undefined : (JSON.parse(text) as { message?: unknown });
    return { status: response.status, message: json?.message };
};

const setup = async (): Promise<{
    user: UserEntity;
    projectUuid: string;
    missionUuid: string;
    numberType: string;
    dateType: string;
    booleanType: string;
}> => {
    const userUuid = await mockDatabaseUser(
        'metadata-values@leggedrobotics.com',
        'Metadata Values User',
        UserRole.ADMIN,
    );
    const user = await getUserFromDatabase(userUuid);
    const numberType = await createMetadataTypeUsingPost(
        { type: DataType.NUMBER, name: 'speed' },
        user,
    );
    const dateType = await createMetadataTypeUsingPost(
        { type: DataType.DATE, name: 'recorded' },
        user,
    );
    const booleanType = await createMetadataTypeUsingPost(
        { type: DataType.BOOLEAN, name: 'outdoor' },
        user,
    );
    const projectUuid = await createProjectUsingPost(
        { name: 'metadata_values_project', description: 'values' },
        user,
    );
    const missionUuid = await createMissionUsingPost(
        {
            name: 'metadata_values_mission',
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        user,
    );
    return {
        user,
        projectUuid,
        missionUuid,
        numberType,
        dateType,
        booleanType,
    };
};

const storedMetadata = (missionUuid: string): Promise<MetadataEntity[]> =>
    database.getRepository(MetadataEntity).find({
        where: { mission: { uuid: missionUuid } },
        relations: { metadataType: true },
    });

describe('Metadata Value Validation', () => {
    setupDatabaseHooks();

    test('should not create a mission if a date value is not a date', async () => {
        const { user, projectUuid, dateType } = await setup();

        const response = await send(user, 'POST', '/missions', {
            name: 'mission_with_bad_date',
            projectUUID: projectUuid,
            metadata: { [dateType]: '13.05.2024' },
            ignoreMissingMetadata: true,
        });

        expect(response.status).toBe(422);
        expect(response.message).toBe(
            'Metadata "recorded" must be a date like 2024-05-13',
        );
        const missions = await database
            .getRepository(MissionEntity)
            .find({ where: { name: 'mission_with_bad_date' } });
        expect(missions).toHaveLength(0);
    });

    test('should report every invalid value at once', async () => {
        const { user, missionUuid, numberType, booleanType } = await setup();

        const response = await send(
            user,
            'POST',
            `/missions/${missionUuid}/metadata`,
            { metadata: { [numberType]: 'abc', [booleanType]: 'maybe' } },
        );

        expect(response.status).toBe(422);
        expect(String(response.message)).toContain(
            'Metadata "speed" must be a number',
        );
        expect(String(response.message)).toContain(
            'Metadata "outdoor" must be true or false',
        );
        expect(await storedMetadata(missionUuid)).toHaveLength(0);
    });

    test('should keep the decimals of a number', async () => {
        const { user, missionUuid, numberType } = await setup();

        const response = await send(
            user,
            'POST',
            `/missions/${missionUuid}/metadata`,
            { metadata: { [numberType]: '1.5' } },
        );

        expect(response.status).toBeLessThan(300);
        const stored = await storedMetadata(missionUuid);
        expect(stored.map((metadata) => metadata.value_number)).toEqual([1.5]);
    });

    test('should accept an ISO date', async () => {
        const { user, missionUuid, dateType } = await setup();

        const response = await send(
            user,
            'POST',
            `/missions/${missionUuid}/metadata`,
            { metadata: { [dateType]: '2024-05-13' } },
        );

        expect(response.status).toBeLessThan(300);
    });

    test('should return 404 if metadata to delete does not exist', async () => {
        const userUuid = await mockDatabaseUser(
            'metadata-deleter@leggedrobotics.com',
            'Metadata Deleter',
            UserRole.USER,
        );
        const user = await getUserFromDatabase(userUuid);

        const response = await send(
            user,
            'DELETE',
            '/metadata/0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b',
        );

        expect(response.status).toBe(404);
    });

    test('should reject a metadata type that cannot hold values', async () => {
        const userUuid = await mockDatabaseUser(
            'metadata-any@leggedrobotics.com',
            'Metadata Any',
            UserRole.ADMIN,
        );
        const user = await getUserFromDatabase(userUuid);

        const response = await send(user, 'POST', '/metadata-types', {
            name: 'anything',
            type: DataType.ANY,
        });

        expect(response.status).toBe(400);
    });
});
