import { readUuidArray } from '@/endpoints/auth/guards/body-fields';
import { containsNulCharacter } from '@/routing/middlewares/nul-character-middleware.service';
import {
    GetFilteredAccessGroupsDto,
    PaginatedQueryDto,
} from '@kleinkram/api-dto';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

const validateQuery = async (
    metatype: new () => object,
    query: Record<string, string>,
): Promise<unknown> =>
    // same options as the global pipe in `main.ts`
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }).transform(query, {
        type: 'query',
        metatype,
    });

describe('Request Input Hardening', () => {
    describe('NUL characters', () => {
        test.each([
            ['a string', 'a\u0000b'],
            ['a nested value', { a: [{ b: 'x\u0000' }] }],
            ['an object key', { ['k\u0000']: 1 }],
        ])('should detect a NUL character in %s', (_label, value) => {
            expect(containsNulCharacter(value)).toBe(true);
        });

        test.each([
            ['undefined', undefined],
            ['null', null],
            ['plain text', 'Raw Data'],
            ['a nested body', { name: 'a', list: ['b', 1, true, null] }],
        ])('should accept %s', (_label, value) => {
            expect(containsNulCharacter(value)).toBe(false);
        });
    });

    describe('uuid arrays read by guards', () => {
        const uuid = '0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b';

        test('should return the uuids of a valid array', () => {
            expect(readUuidArray({ fileUUIDs: [uuid] }, 'fileUUIDs')).toEqual([
                uuid,
            ]);
        });

        test('should return undefined if the body or field is missing', () => {
            expect(readUuidArray(undefined, 'fileUUIDs')).toBeUndefined();
            expect(readUuidArray({}, 'fileUUIDs')).toBeUndefined();
        });

        test.each([
            ['a string', uuid],
            ['a number', 123],
            ['an object', { a: uuid }],
            ['an array with a non-uuid', [uuid, 'not-a-uuid']],
            ['an array with a number', [1]],
        ])('should reject %s with 400', (_label, value) => {
            expect(() =>
                readUuidArray({ fileUUIDs: value }, 'fileUUIDs'),
            ).toThrow(BadRequestException);
        });
    });

    describe('pagination bounds', () => {
        test('should reject a skip larger than Postgres can offset', async () => {
            await expect(
                validateQuery(PaginatedQueryDto, {
                    skip: '100000000000000000000',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        test('should accept a regular skip', async () => {
            await expect(
                validateQuery(PaginatedQueryDto, { skip: '200' }),
            ).resolves.toMatchObject({ skip: 200 });
        });

        test('should accept a regular access group search', async () => {
            await expect(
                validateQuery(GetFilteredAccessGroupsDto, {
                    search: '',
                    skip: '0',
                    take: '10',
                }),
            ).resolves.toMatchObject({ skip: 0, take: 10 });
        });

        test.each([
            ['skip', '-1', '10'],
            ['take', '0', '-1'],
        ])(
            'should reject a negative %s in the access group search',
            async (_label, skip, take) => {
                await expect(
                    validateQuery(GetFilteredAccessGroupsDto, {
                        search: '',
                        skip,
                        take,
                    }),
                ).rejects.toThrow(BadRequestException);
            },
        );
    });
});
