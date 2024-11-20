import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
    BooleanValidate,
    DateStringValidate,
    NumberValidate,
    StringArrayValidate,
    StringValidate,
    UUIDValidate,
} from './validationTypes';
import { metadataApplier } from './MetadataApplier';

export const QueryUUID = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID`,
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'string',
            true,
            'uuid',
        ),
    )(paramName);

export const QueryOptionalUUID = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID`,
                );
            });

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'uuid', false),
    )(paramName);

export const QueryString = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String`,
                );
            });

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'string', true),
    )(paramName);

export const QueryOptionalString = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String`,
                );
            });

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'string', false),
    )(paramName);

export const QueryStringArray = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];
            const object = plainToInstance(StringArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String Array`,
                );
            });

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'string[]', true),
    )(paramName);

export const QueryOptionalStringArray = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];
            if (value === undefined) {
                return;
            }
            const object = plainToInstance(StringArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String Array`,
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'string[]',
            false,
        ),
    )(paramName);

export const QueryBoolean = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];
            const object = plainToInstance(BooleanValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Boolean`,
                );
            });

            // convert type to boolean
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true') return true;
                else if (value.toLowerCase() === 'false') return false;
            }

            throw new BadRequestException(
                `Parameter ${data} is not a valid Boolean`,
            );
        },
        metadataApplier(paramName, paramDescription, 'query', 'boolean', true),
    )(paramName);

export const QueryOptionalBoolean = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];
            if (value === undefined) {
                return;
            }
            const object = plainToInstance(BooleanValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Boolean`,
                );
            });

            // convert type to boolean
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true') return true;
                else if (value.toLowerCase() === 'false') return false;
            }

            throw new BadRequestException(
                `Parameter ${data} is not a valid Boolean`,
            );
        },
        metadataApplier(paramName, paramDescription, 'query', 'boolean', false),
    )(paramName);

export const QueryDate = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return new Date(0);
            }

            const object = plainToInstance(DateStringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Date`,
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'DateString',
            false,
        ),
    )(paramName);

export const QuerySortBy = (paramName: string, paramDescription?: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === '' || value === undefined) {
                return 'uuid'; // default value
            }

            // check if value is a valid field
            const fields = [
                'uuid',
                'name',
                'description',
                'creator',
                'creator.name',
                'createdAt',
                'updatedAt',
                'filename',
                'state',
                'size',
                'file.date',
                'file.createdAt',
                'file.size',
                'file.filename',
                'state',
                'state_cause',
            ];

            if (!fields.includes(value)) {
                throw new BadRequestException('Parameter is not a valid field');
            }

            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid SortBy',
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription || 'Sort response by',
            'query',
            'string (sortable field)',
            true,
        ),
    )(paramName);

export const QuerySortDirection = (
    paramName: string,
    paramDescription?: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            let value = request.query[data];

            if (value === '' || value === undefined) {
                return 'ASC'; // default value
            }

            value = value.toUpperCase();
            if (value !== 'ASC' && value !== 'DESC') {
                throw new BadRequestException(
                    'Parameter is not a valid SortDirection',
                );
            }

            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid SortDirection',
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription || 'Sort response direction',
            'query',
            'boolean',
            false,
        ),
    )(paramName);

export const QueryProjectSearchParam = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return new Map<string, string>();
            }

            // check if it is a valid key
            const validKeys = ['name', 'creator.uuid'];
            const key = Object.keys(value)[0];
            if (!validKeys.includes(key)) {
                throw new BadRequestException('Parameter is not a valid key');
            }

            // remove empty values
            Object.keys(value).forEach((_key) => {
                if (value[_key] === '') {
                    delete value[_key];
                }
            });

            // check if every value is a string
            Object.keys(value).forEach((_key) => {
                if (typeof value[_key] !== 'string') {
                    throw new BadRequestException(
                        'Parameter is not a valid value',
                    );
                }
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'Record<name | creator.uuid, string>',
            true,
        ),
    )(paramName);

export const QueryOptionalDate = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }
            const object = plainToInstance(DateStringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Date`,
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'dateString',
            false,
        ),
    )(paramName);

export const QueryOptionalNumber = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            const object = plainToInstance(NumberValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid Number',
                );
            });

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'number', false),
    )(paramName);

export const QuerySkip = (paramName: string, paramDescription?: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return 0;
            }

            if (value < 0) {
                throw new BadRequestException('QuerySkip is too small');
            }

            const object = plainToInstance(NumberValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid Number',
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription || 'Pagination Skip',
            'query',
            'number',
            false,
        ),
    )(paramName);

export const QueryTake = (paramName: string, paramDescription?: string) =>
    createParamDecorator(
        async (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return 100; // default value
            }

            if (value > 10_000) {
                throw new BadRequestException('QueryTake is too large');
            } else if (value < 1) {
                throw new BadRequestException('QueryTake is too small');
            }

            const object = plainToInstance(NumberValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid Number',
                );
            });

            return value;
        },
        metadataApplier(
            paramName,
            paramDescription || 'Pagination Take',
            'query',
            'number',
            false,
        ),
    )(paramName);

export const QueryOptional = (paramName: string, paramDescription: string) =>
    createParamDecorator(
        (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            return value;
        },
        metadataApplier(paramName, paramDescription, 'query', 'any', false),
    )(paramName);

export const QueryOptionalRecord = (
    paramName: string,
    paramDescription: string,
) =>
    createParamDecorator(
        (data: string, ctx: ExecutionContext) => {
            const request = ctx.switchToHttp().getRequest();
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            return JSON.parse(value.replace(/'/g, '"'));
        },
        metadataApplier(
            paramName,
            paramDescription,
            'query',
            'Record<unknown, unknown>',
            false,
        ),
    )(paramName);
