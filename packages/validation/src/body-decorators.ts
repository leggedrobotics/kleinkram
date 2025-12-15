import {
    applyDecorators,
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    InternalServerErrorException,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsUUID, validateOrReject } from 'class-validator';
import { metadataApplier } from './metadata-applier';
import {
    OptionalStringValidate,
    SourceValidate,
    StringValidate,
    UUIDValidate,
} from './validation-types';

export function ApiUUIDProperty(description = 'UUID'): PropertyDecorator {
    return applyDecorators(
        IsUUID(),
        ApiProperty({
            description,
            type: 'string',
            format: 'uuid',
        }),
    );
}

export const BodyUUID = (parameterName: string, parameterDescription: string) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            if (!data) {
                throw new InternalServerErrorException(
                    'Parameter is missing field in controller',
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object as object).catch(() => {
                throw new BadRequestException(
                    'Body parameter is not a valid UUID',
                );
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'uuid',
            true,
        ),
    )(parameterName);

export const BodyString = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object as object).catch(() => {
                throw new BadRequestException(
                    undefined,
                    'Parameter is not a valid String',
                );
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'string',
            true,
        ),
    )(parameterName);

export const BodyOptionalString = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];

            if (value === undefined) return;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(OptionalStringValidate, { value });
            await validateOrReject(object as object).catch(() => {
                throw new BadRequestException(
                    undefined,
                    'Parameter is not a valid String',
                );
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'string',
            false,
        ),
    )(parameterName);

export const BodyOptionalSource = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];

            if (value === undefined) return;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(SourceValidate, { value });
            await validateOrReject(object as object).catch(() => {
                throw new BadRequestException(
                    undefined,
                    'Parameter is not a valid Source',
                );
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'string',
            false,
        ),
    )(parameterName);

export const BodyNotNull = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];

            if (value === undefined || value === null) {
                throw new BadRequestException('Parameter is empty');
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'unknown',
            true,
        ),
    )(parameterName);

export const BodyUUIDArray = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.body[data];

            if (!Array.isArray(value)) {
                throw new BadRequestException('Parameter is not an array');
            }

            for (const uuid of value) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const object = plainToInstance(UUIDValidate, { value: uuid });
                await validateOrReject(object as object).catch(() => {
                    throw new BadRequestException(
                        'Body parameter is not a valid UUID',
                    );
                });
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'body',
            'uuid[]',
            true,
        ),
    )(parameterName);
