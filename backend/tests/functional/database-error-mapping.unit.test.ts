import { mapDatabaseError } from '@/routing/filters/database-error-mapping';
import { EntityPropertyNotFoundError, QueryFailedError } from 'typeorm';

const queryFailed = (
    code: string,
    message: string,
    detail?: string,
): QueryFailedError =>
    new QueryFailedError(
        'SELECT 1',
        [],
        Object.assign(new Error(message), { code, detail }),
    );

describe('Database Error Mapping', () => {
    test('should map a unique violation to 409 Already exists', () => {
        const mapped = mapDatabaseError(
            queryFailed(
                '23505',
                'duplicate key value violates unique constraint "unique_access_group_name"',
                'Key (name)=(group) already exists.',
            ),
        );

        expect(mapped?.status).toBe(409);
        expect(mapped?.message).toBe('Already exists');
    });

    test('should map a foreign key violation on delete to 409 Still in use', () => {
        const mapped = mapDatabaseError(
            queryFailed(
                '23503',
                'update or delete on table "access_group" violates foreign key constraint',
                'Key (uuid)=(…) is still referenced from table "project_access".',
            ),
        );

        expect(mapped?.status).toBe(409);
        expect(mapped?.message).toBe('Still in use');
    });

    test('should map a foreign key violation on insert to 400', () => {
        const mapped = mapDatabaseError(
            queryFailed(
                '23503',
                'insert or update on table "category" violates foreign key constraint',
                'Key (projectUuid)=(…) is not present in table "project".',
            ),
        );

        expect(mapped?.status).toBe(400);
        expect(mapped?.message).toBe('Referenced resource does not exist');
    });

    test('should map a not-null violation to 400', () => {
        const mapped = mapDatabaseError(
            queryFailed('23502', 'null value in column "name" violates'),
        );

        expect(mapped?.status).toBe(400);
    });

    test.each([
        ['22P02', 'invalid input value for enum ingestion_job_state_enum: "x"'],
        ['22003', 'bigint out of range'],
        ['22007', 'invalid input syntax for type timestamp: "x"'],
        ['22021', 'invalid byte sequence for encoding "UTF8": 0x00'],
        ['2201W', 'LIMIT must not be negative'],
    ])(
        'should map data exception %s to 400 Invalid value in request',
        (code, message) => {
            const mapped = mapDatabaseError(queryFailed(code, message));

            expect(mapped?.status).toBe(400);
            expect(mapped?.message).toBe('Invalid value in request');
        },
    );

    test('should keep the Invalid UUID message for malformed uuids', () => {
        const mapped = mapDatabaseError(
            queryFailed('22P02', 'invalid input syntax for type uuid: "abc"'),
        );

        expect(mapped).toMatchObject({ status: 400, message: 'Invalid UUID' });
    });

    test('should map an unknown entity property to 400', () => {
        const mapped = mapDatabaseError(
            new EntityPropertyNotFoundError('fuzz', {
                name: 'ApiKeyEntity',
            } as never),
        );

        expect(mapped?.status).toBe(400);
    });

    test('should not send database details to the client', () => {
        const mapped = mapDatabaseError(
            queryFailed(
                '23505',
                'duplicate key value violates unique constraint "secret_index"',
                'Key (name)=(secret) already exists.',
            ),
        );

        expect(mapped?.message).not.toContain('secret');
        expect(mapped?.logDetail).toContain('secret');
    });

    test.each([
        ['42601', 'syntax error at or near ")"'],
        ['57014', 'canceling statement due to statement timeout'],
        ['08006', 'connection failure'],
    ])('should leave server error %s unmapped', (code, message) => {
        expect(mapDatabaseError(queryFailed(code, message))).toBeUndefined();
    });

    test('should leave errors that are not database errors unmapped', () => {
        expect(
            mapDatabaseError(new TypeError('x is undefined')),
        ).toBeUndefined();
    });
});
