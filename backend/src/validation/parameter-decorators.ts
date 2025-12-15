import { metadataApplier, UUIDValidate } from '@kleinkram/validation';
import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export const ParameterUuid = (
    parameterName: string,
    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.params[data];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException('Parameter is not a valid UUID!');
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
        },
        metadataApplier(
            parameterName,
            parameterDescription ?? 'UUID',
            'path',
            'string',
            true,
            'uuid',
        ),
    )(parameterName);
