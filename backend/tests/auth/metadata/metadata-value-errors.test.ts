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

interface ValidationErrorBody {
    message: string;
    errors: { field: string; name: string; error: string }[];
}

const setup = async (): Promise<{
    user: UserEntity;
    projectUuid: string;
    missionUuid: string;
    types: Record<'link' | 'location' | 'number' | 'date' | 'boolean', string>;
}> => {
    const suffix = String(Date.now());
    const user = await getUserFromDatabase(
        await mockDatabaseUser(
            'metadata-value-errors@leggedrobotics.com',
            'Metadata Values User',
            UserRole.ADMIN,
        ),
    );
    const createType = (type: DataType, name: string): Promise<string> =>
        createMetadataTypeUsingPost({ type, name: `${name}_${suffix}` }, user);
    const types = {
        link: await createType(DataType.LINK, 'audio'),
        location: await createType(DataType.LOCATION, 'coordinates'),
        number: await createType(DataType.NUMBER, 'speed'),
        date: await createType(DataType.DATE, 'recorded'),
        boolean: await createType(DataType.BOOLEAN, 'calibrated'),
    };
    const projectUuid = await createProjectUsingPost(
        {
            name: `metadata_values_project_${suffix}`,
            description: 'Test project',
            requiredMetadataTypes: [],
        },
        user,
    );
    const missionUuid = await createMissionUsingPost(
        {
            name: `metadata_values_mission_${suffix}`,
            projectUUID: projectUuid,
            metadata: {},
            ignoreMissingMetadata: true,
        },
        user,
    );
    return { user, projectUuid, missionUuid, types };
};

const post = (
    user: UserEntity,
    path: string,
    body: unknown,
): Promise<Response> =>
    fetch(`${DEFAULT_URL}${path}`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(user),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

describe('Metadata Value Errors', () => {
    setupDatabaseHooks();

    test('should report every invalid metadata value when updating a mission', async () => {
        const { user, missionUuid, types } = await setup();

        const response = await post(user, `/missions/${missionUuid}/metadata`, {
            metadata: {
                [types.link]: 'example.com/audio.wav',
                [types.number]: 'fast',
                [types.date]: 'yesterday',
                [types.boolean]: 'maybe',
            },
        });

        expect(response.status).toBe(422);
        const body = (await response.json()) as ValidationErrorBody;
        expect(new Set(body.errors.map((error) => error.field))).toEqual(
            new Set([types.link, types.number, types.date, types.boolean]),
        );
        for (const error of body.errors) {
            expect(error.error.length).toBeGreaterThan(0);
        }
        // nothing was written
        const metadata = await database.getRepository(MetadataEntity).find({
            where: { mission: { uuid: missionUuid } },
        });
        expect(metadata).toHaveLength(0);
    });

    test('should report every invalid metadata value when creating a mission', async () => {
        const { user, projectUuid, types } = await setup();

        const response = await post(user, '/missions', {
            name: `invalid_metadata_${String(Date.now())}`,
            projectUUID: projectUuid,
            metadata: {
                [types.link]: 'javascript:alert(1)',
                [types.location]: 'Zurich',
                [types.date]: '13.05.2024',
                [types.number]: '12',
            },
            ignoreMissingMetadata: true,
        });

        expect(response.status).toBe(422);
        const body = (await response.json()) as ValidationErrorBody;
        expect(new Set(body.errors.map((error) => error.field))).toEqual(
            new Set([types.link, types.date]),
        );
    });

    test('should accept valid values of every type', async () => {
        const { user, missionUuid, types } = await setup();

        const response = await post(user, `/missions/${missionUuid}/metadata`, {
            metadata: {
                [types.link]: 'https://example.com/audio.wav',
                [types.location]: 'Zurich',
                [types.number]: '12.5',
                [types.date]: '2026-11-13',
            },
        });

        expect(response.status).toBeLessThan(300);
    });

    test('should store a boolean written as "True" or "FALSE" with its real value', async () => {
        const { user, missionUuid, types } = await setup();
        const stored = async (): Promise<boolean | undefined> => {
            const entry = await database
                .getRepository(MetadataEntity)
                .findOneOrFail({
                    where: {
                        mission: { uuid: missionUuid },
                        metadataType: { uuid: types.boolean },
                    },
                });
            return entry.value_boolean;
        };

        const upper = await post(user, `/missions/${missionUuid}/metadata`, {
            metadata: { [types.boolean]: 'True' },
        });
        expect(upper.status).toBeLessThan(300);
        expect(await stored()).toBe(true);

        const lower = await post(user, `/missions/${missionUuid}/metadata`, {
            metadata: { [types.boolean]: ' FALSE ' },
        });
        expect(lower.status).toBeLessThan(300);
        expect(await stored()).toBe(false);
    });

    test('should create a mission and ignore an empty metadata value', async () => {
        const { user, projectUuid, types } = await setup();
        const name = `empty_value_${String(Date.now())}`;

        const response = await post(user, '/missions', {
            name,
            projectUUID: projectUuid,
            metadata: { [types.link]: '', [types.number]: '4' },
            ignoreMissingMetadata: true,
        });

        expect(response.status).toBeLessThan(300);
        const metadata = await database.getRepository(MetadataEntity).find({
            where: { mission: { name } },
            relations: { metadataType: true },
        });
        expect(metadata.map((entry) => entry.metadataType?.uuid)).toEqual([
            types.number,
        ]);
    });

    test('should not create a mission when metadata the project requires is missing or empty', async () => {
        const { user, types } = await setup();
        const suffix = String(Date.now());
        const projectUuid = await createProjectUsingPost(
            {
                name: `required_metadata_project_${suffix}`,
                description: 'Test project',
                requiredMetadataTypes: [types.number],
            },
            user,
        );

        for (const metadata of [{}, { [types.number]: '' }]) {
            const name = `required_missing_${suffix}`;
            const response = await post(user, '/missions', {
                name,
                projectUUID: projectUuid,
                metadata,
            });
            expect(response.status).toBe(409);
            expect(
                await database
                    .getRepository(MissionEntity)
                    .exists({ where: { name } }),
            ).toBe(false);
        }

        const provided = await post(user, '/missions', {
            name: `required_given_${suffix}`,
            projectUUID: projectUuid,
            metadata: { [types.number]: '4' },
        });
        expect(provided.status).toBeLessThan(300);

        // the key is a UUID: its case does not matter
        const uppercase = await post(user, '/missions', {
            name: `required_uppercase_${suffix}`,
            projectUUID: projectUuid,
            metadata: { [types.number.toUpperCase()]: '4' },
        });
        expect(uppercase.status).toBeLessThan(300);
    });
});
