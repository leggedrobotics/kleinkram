import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    InternalServerErrorException,
} from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { NameValidate, StringValidate, UUIDValidate } from './validationTypes';
import { AccessGroupRights, DataType } from '@common/enum';

// eslint-disable-next-line @typescript-eslint/naming-convention
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
        await validateOrReject(object).catch(() => {
            throw new BadRequestException('Body parameter is not a valid UUID');
        });

        return value;
    },
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyString = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
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
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyName = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        const object = plainToInstance(NameValidate, { value });
        await validateOrReject(object).catch(() => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);

// eslint-disable-next-line @typescript-eslint/naming-convention
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

// eslint-disable-next-line @typescript-eslint/naming-convention
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

// eslint-disable-next-line @typescript-eslint/naming-convention
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

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyUUIDArray = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
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
);
