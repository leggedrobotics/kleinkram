import {
    AddMetadataTypeQueryDto,
    UpdateMetadataTypesBodyDto,
} from '@kleinkram/api-dto';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';

const SOME_UUID = '3f2ad2c6-6e2a-4c6b-9a1d-9f6f0f3b7f21';
const OTHER_UUID = '8a1d3c40-1f2e-4e1a-9c3b-2b5f7c0a1d44';

/**
 * `PUT /projects/:uuid/metadata-types` replaces a project's full set of
 * required metadata types, so a body naming neither field must be rejected
 * rather than being read as "clear everything". These tests run the same
 * `ValidationPipe` configuration the application installs globally.
 */
describe('Project metadata type request validation', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    });

    const validate = async (
        metadata: ArgumentMetadata,
        value: unknown,
    ): Promise<{ status: number; messages: string[] }> => {
        try {
            await pipe.transform(value, metadata);
            return { status: 200, messages: [] };
        } catch (error) {
            const response = (
                error as {
                    response?: { statusCode?: number; message?: string[] };
                }
            ).response;
            return {
                status: response?.statusCode ?? 500,
                messages: response?.message ?? [],
            };
        }
    };

    describe('UpdateMetadataTypesBodyDto', () => {
        const body: ArgumentMetadata = {
            type: 'body',
            metatype: UpdateMetadataTypesBodyDto,
        };

        test('rejects an empty body instead of clearing the project', async () => {
            const { status, messages } = await validate(body, {});
            expect(status).toBe(400);
            expect(messages.join(' ')).toContain(
                'At least one of the following fields must be present',
            );
        });

        test('rejects a body that only carries a misspelled key', async () => {
            const { status } = await validate(body, {
                metadataTypeUuids: [SOME_UUID],
            });
            expect(status).toBe(400);
        });

        test('allows an explicit empty array (clearing on purpose)', async () => {
            const { status } = await validate(body, { metadataTypeUUIDs: [] });
            expect(status).toBe(200);
        });

        test('allows the deprecated tagTypeUUIDs alias', async () => {
            const { status } = await validate(body, {
                tagTypeUUIDs: [SOME_UUID, OTHER_UUID],
            });
            expect(status).toBe(200);
        });

        test('rejects entries that are not uuids', async () => {
            const { status } = await validate(body, {
                metadataTypeUUIDs: ['not-a-uuid'],
            });
            expect(status).toBe(400);
        });

        test('rejects a non-array value', async () => {
            const { status } = await validate(body, {
                metadataTypeUUIDs: SOME_UUID,
            });
            expect(status).toBe(400);
        });
    });

    describe('AddMetadataTypeQueryDto', () => {
        const query: ArgumentMetadata = {
            type: 'query',
            metatype: AddMetadataTypeQueryDto,
        };

        test('rejects a request without a type uuid', async () => {
            const { status, messages } = await validate(query, {});
            expect(status).toBe(400);
            expect(messages.join(' ')).toContain(
                'At least one of the following fields must be present',
            );
        });

        test('accepts metadataTypeUUID', async () => {
            const { status } = await validate(query, {
                metadataTypeUUID: SOME_UUID,
            });
            expect(status).toBe(200);
        });

        test('accepts the deprecated tagTypeUUID alias', async () => {
            const { status } = await validate(query, {
                tagTypeUUID: SOME_UUID,
            });
            expect(status).toBe(200);
        });
    });
});
