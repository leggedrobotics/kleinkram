import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    InternalServerErrorException,
} from '@nestjs/common';
import {
    validateOrReject,
    IsUUID,
    IsString,
    IsNotEmpty,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StringValidate, UUIDValidate } from './validationTypes';
import { AccessGroupRights, DataType } from '@common/enum';

export const BodyUUID = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        if (!data) {
            throw new InternalServerErrorException(
                'Parameter is missing field in controller',
            );
        }
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];
        const object = plainToInstance(UUIDValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Body parameter is not a valid UUID');
        });

        return value;
    },
);

export const BodyString = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);

export const BodyAccessGroupRights = createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        if (!Object.values(AccessGroupRights).includes(value)) {
            throw new BadRequestException(
                'Parameter is not a valid AccessGroupRights',
            );
        }

        return value;
    },
);

export const BodyDataType = createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        if (!Object.values(DataType).includes(value)) {
            throw new BadRequestException('Parameter is not a valid DataType');
        }

        return value;
    },
);

export const BodyNotNull = createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        if (value === undefined || value === null) {
            throw new BadRequestException('Parameter is empty');
        }

        return value;
    },
);
