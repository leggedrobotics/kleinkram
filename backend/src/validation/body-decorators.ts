import {
    applyDecorators,
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    InternalServerErrorException,
} from '@nestjs/common';
import { IsUUID, validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StringValidate, UUIDValidate } from './validation-types';
import { metadataApplier } from './metadata-applier';
import { ApiProperty } from '@nestjs/swagger';

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
            const request = context.switchToHttp().getRequest();
            const value = request.body[data];
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Body parameter is not a valid UUID',
                );
            });

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
            const request = context.switchToHttp().getRequest();
            const value = request.body[data];

            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    undefined,
                    'Parameter is not a valid String',
                );
            });

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

export const BodyNotNull = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            const request = context.switchToHttp().getRequest();
            const value = request.body[data];

            if (value === undefined || value === null) {
                throw new BadRequestException('Parameter is empty');
            }

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
            const request = context.switchToHttp().getRequest();
            const value = request.body[data];

            if (!Array.isArray(value)) {
                throw new BadRequestException('Parameter is not an array');
            }

            for (const uuid of value) {
                const object = plainToInstance(UUIDValidate, { value: uuid });
                await validateOrReject(object).catch(() => {
                    throw new BadRequestException(
                        'Body parameter is not a valid UUID',
                    );
                });
            }

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
