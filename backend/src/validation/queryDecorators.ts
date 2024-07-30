import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
    BooleanValidate,
    StringArrayValidate,
    StringValidate,
    UUIDValidate,
} from './validationTypes';

export const QueryUUID = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];
        const object = plainToInstance(UUIDValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid UUID');
        });

        return value;
    },
);

export const QueryOptionalUUID = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        const object = plainToInstance(UUIDValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid UUID');
        });

        return value;
    },
);

export const QueryString = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);

export const QueryOptionalString = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
);

export const QueryStringArray = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        const object = plainToInstance(StringArrayValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException(
                'Parameter is not a valid String Array',
            );
        });

        return value;
    },
);

export const QueryBoolean = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];
        const object = plainToInstance(BooleanValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Boolean');
        });

        // convert type to boolean
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') return true;
            else if (value.toLowerCase() === 'false') return false;
        }

        throw new BadRequestException('Parameter is not a valid Boolean');
    },
);

export const QueryOptionalBoolean = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }
        const object = plainToInstance(BooleanValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Boolean');
        });

        // convert type to boolean
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') return true;
            else if (value.toLowerCase() === 'false') return false;
        }

        throw new BadRequestException('Parameter is not a valid Boolean');
    },
);

export const QueryDate = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Date');
        });

        return value;
    },
);

export const QueryOptionalDate = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Date');
        });

        return value;
    },
);
