import { GlobalResponseValidationInterceptor } from '@/routing/interceptors/output-validation';
import {
    CancelProcessingResponseDto,
    DeleteMissionResponseDto,
} from '@kleinkram/api-dto';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';

// eslint-disable-next-line @typescript-eslint/no-empty-function
function routeHandler(): void {}

const buildContext = (): ExecutionContext =>
    ({
        getHandler: () => routeHandler,
        switchToHttp: () => ({ getRequest: () => ({}) }),
    }) as unknown as ExecutionContext;

const validate = async (dto: unknown, body: unknown): Promise<unknown> => {
    const reflector = {
        get: (key: string): unknown => (key === 'outputDto' ? dto : undefined),
    } as unknown as Reflector;

    const next = { handle: () => of(body) } as unknown as CallHandler;

    return firstValueFrom(
        new GlobalResponseValidationInterceptor(reflector).intercept(
            buildContext(),
            next,
        ),
    );
};

/**
 * Several routes intentionally answer with an empty body and describe it with an
 * empty DTO (`CancelProcessingResponseDto`, `AddMetadataTypeDto`, ...).
 * class-validator's `forbidUnknownValues` rejects any class without validation
 * metadata, which used to turn every one of those successful responses into a
 * 500 whenever the interceptor is enabled (development and CI).
 */
describe('GlobalResponseValidationInterceptor', () => {
    test('accepts an empty body for an empty response DTO', async () => {
        await expect(
            validate(CancelProcessingResponseDto, {}),
        ).resolves.toEqual({});
    });

    test('still rejects unexpected properties on an empty response DTO', async () => {
        await expect(
            validate(CancelProcessingResponseDto, { leaked: 'secret' }),
        ).rejects.toThrow('Validation failed');
    });

    test('accepts a valid body for a populated response DTO', async () => {
        await expect(
            validate(DeleteMissionResponseDto, { success: true }),
        ).resolves.toEqual({ success: true });
    });

    test('rejects a missing property on a populated response DTO', async () => {
        await expect(validate(DeleteMissionResponseDto, {})).rejects.toThrow(
            'Validation failed',
        );
    });

    test('rejects an extra property on a populated response DTO', async () => {
        await expect(
            validate(DeleteMissionResponseDto, { success: true, extra: 1 }),
        ).rejects.toThrow('Validation failed');
    });
});
