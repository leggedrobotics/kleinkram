import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StringValidate, UUIDValidate } from './validationTypes';
import { metadataApplier } from './MetadataApplier';

export const ParamUUID = (
    parameterName: string,
    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            const request = context.switchToHttp().getRequest();
            const value = request.params[data];
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException('Parameter is not a valid UUID!');
            });

            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription || 'UUID',
            'path',
            'string',
            true,
            'uuid',
        ),
    )(parameterName);

export const ParamString = createParamDecorator(
    async (data: string, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const value = request.params[data];

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch(() => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);
