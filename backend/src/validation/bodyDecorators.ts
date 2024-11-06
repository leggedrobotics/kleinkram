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
import { metadataApplier } from './MetadataApplier';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyUUID = (paramName: string, paramDescription: string)=> createParamDecorator(
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
    metadataApplier(paramName, paramDescription, 'body', 'uuid', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyString = (paramName: string, paramDescription: string)=> createParamDecorator(
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
    metadataApplier(paramName, paramDescription, 'body', 'string', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyName = (paramName: string, paramDescription: string)=> createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        const object = plainToInstance(NameValidate, { value });
        await validateOrReject(object).catch(() => {
            throw new BadRequestException('Parameter is not a valid String');
        });

        return value;
    },
    metadataApplier(paramName, paramDescription, 'body', 'string', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyAccessGroupRights = (paramName: string, paramDescription: string)=> createParamDecorator(
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
    metadataApplier(paramName, paramDescription, 'body', 'AccessGroupRights', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyDataType = (paramName: string, paramDescription: string)=> createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        if (!Object.values(DataType).includes(value)) {
            throw new BadRequestException('Parameter is not a valid DataType');
        }

        return value;
    },
    metadataApplier(paramName, paramDescription, 'body', 'DataType', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyNotNull =(paramName: string, paramDescription: string)=>  createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.body[data];

        if (value === undefined || value === null) {
            throw new BadRequestException('Parameter is empty');
        }

        return value;
    },
    metadataApplier(paramName, paramDescription, 'body', 'unknown', true)
)(paramName);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BodyUUIDArray = (paramName: string, paramDescription: string)=> createParamDecorator(
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
    metadataApplier(paramName, paramDescription, 'body', 'uuid[]', true)
)(paramName);
