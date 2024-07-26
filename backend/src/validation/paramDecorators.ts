import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import {
    validateOrReject,
    IsUUID,
    IsString,
    IsNotEmpty,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StringValidate, UUIDValidate } from './validationTypes';

export const ParamUUID = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.params[data];

        const object = plainToInstance(UUIDValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid UUID');
        });

        return value;
    },
);
export const ParamString = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.params[data];

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);
