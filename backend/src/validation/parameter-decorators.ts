import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { metadataApplier } from './metadata-applier';
import { UUIDValidate } from './validation-types';

export const ParameterUuid = (
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
