import { AccessGroupType } from '@kleinkram/shared';
import {
    BooleanValidate,
    DateStringValidate,
    metadataApplier,
    NumberValidate,
    StringArrayValidate,
    StringValidate,
    UUIDArrayValidate,
    UUIDValidate,
} from '@kleinkram/validation';
import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export const QueryUUID = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'string',
            true,
            'uuid',
        ),
    )(parameterName);

export const QueryOptionalUUID = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        // TODO: what type should this be? string | undefined or string
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'uuid',
            false,
        ),
    )(parameterName);

export const QueryString = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'string',
            true,
        ),
    )(parameterName);

export const QueryOptionalString = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined || value === '') {
                return '';
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'string',
            false,
        ),
    )(parameterName);

export const QueryStringArray = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string[]> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const raw_value = request.query[data];

            if (raw_value === undefined) {
                return [];
            }

            let value = [];
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                value = JSON.parse(raw_value);
            } catch {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid JSON String Array`,
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String Array`,
                );
            });

            return value as string[];
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'string[]',
            true,
        ),
    )(parameterName);

export const QueryOptionalStringArray = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string[]> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const raw_value = request.query[data];

            if (raw_value === undefined) {
                return [];
            }

            let value = [];
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                value = JSON.parse(raw_value);
            } catch {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid JSON String Array`,
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid String Array`,
                );
            });

            return value as string[];
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'string[]',
            false,
        ),
    )(parameterName);

export const QueryOptionalUUIDArray = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string[]> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const raw_value = request.query[data];

            if (raw_value === undefined) {
                return [];
            }

            let value = [];
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                value = JSON.parse(raw_value);
            } catch {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID Array`,
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID Array`,
                );
            });

            return value as string[];
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'uuid[]',
            false,
        ),
    )(parameterName);

export const QueryUUIDArray = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<string[]> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const raw_value = request.query[data];

            if (raw_value === undefined) {
                return [];
            }

            let value = [];
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                value = JSON.parse(raw_value);
            } catch {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID Array`,
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(UUIDArrayValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid UUID Array`,
                );
            });

            return value as string[];
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'uuid[]',
            true,
        ),
    )(parameterName);

export const QueryBoolean = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            // Handle string "true" or "false" conversion first
            let booleanValue: boolean | undefined;
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true') {
                    booleanValue = true;
                } else if (value.toLowerCase() === 'false') {
                    booleanValue = false;
                }
            } else if (typeof value === 'boolean') {
                booleanValue = value;
            }

            // If it's not a recognizable boolean string or an actual boolean,
            // throw an error or attempt validation with the original value
            if (booleanValue === undefined) {
                throw new BadRequestException(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `Parameter ${data} is not a valid Boolean. Received: "${value}"`,
                );
            }

            return booleanValue;
        },
        // Ensure metadataApplier is correctly imported or defined
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'boolean',
            true,
        ),
    )(parameterName);

export const QueryOptionalBoolean = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];
            if (value === undefined) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'boolean',
            false,
        ),
    )(parameterName);

export const QueryDate = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return new Date(0);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(DateStringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Date`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'DateString',
            false,
        ),
    )(parameterName);

export const QuerySortBy = (
    parameterName: string,
    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
                'state',
                'state_cause',
                'key_type',
                'rights',
                'deletedAt',
            ];

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            if (!fields.includes(value)) {
                throw new BadRequestException('Parameter is not a valid field');
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid SortBy',
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription ?? 'Sort response by',
            'query',
            'string (sortable field)',
            true,
        ),
    )(parameterName);

export const QuerySortDirection = (
    parameterName: string,
    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            let value = request.query[data];

            if (value === '' || value === undefined) {
                return 'ASC'; // default value
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            value = value.toUpperCase();
            if (value !== 'ASC' && value !== 'DESC') {
                throw new BadRequestException(
                    'Parameter is not a valid SortDirection',
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(StringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid SortDirection',
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription ?? 'Sort response direction',
            'query',
            'boolean',
            false,
        ),
    )(parameterName);

export const QueryProjectSearchParameters = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return new Map<string, string>();
            }

            // check if it is a valid key
            const validKeys = ['name', 'creator.uuid'];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const key = Object.keys(value)[0] ?? '';
            if (!validKeys.includes(key)) {
                throw new BadRequestException('Parameter is not a valid key');
            }

            // remove empty values

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            for (const _key of Object.keys(value)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (value[_key] === '') {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-unsafe-member-access
                    delete value[_key];
                }
            }

            // check if every value is a string

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            for (const _key of Object.keys(value)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (typeof value[_key] !== 'string') {
                    throw new BadRequestException(
                        'Parameter is not a valid value',
                    );
                }
            }

            return value as Record<string, string>;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'Record<name | creator.uuid, string>',
            true,
        ),
    )(parameterName);

export const QueryOptionalDate = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(DateStringValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    `Parameter ${data} is not a valid Date`,
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'dateString',
            false,
        ),
    )(parameterName);

export const QueryOptionalNumber = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const object = plainToInstance(NumberValidate, { value });
            await validateOrReject(object).catch(() => {
                throw new BadRequestException(
                    'Parameter is not a valid Number',
                );
            });

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'number',
            false,
        ),
    )(parameterName);

export const QueryOptionalAccessGroupType = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (
            data: string,
            context: ExecutionContext,
        ): AccessGroupType | undefined => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return undefined;
            }

            // validate if value is a valid AccessGroupType
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            if (!Object.values(AccessGroupType).includes(value)) {
                throw new BadRequestException(
                    'Parameter is not a valid AccessGroupType',
                );
            }

            return value as AccessGroupType;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'AccessGroupType',
            false,
        ),
    )(parameterName);

export const QuerySkip = (
    parameterName: string,
    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<number> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-member-access
            const value_raw = request.query[data] as string | undefined;

            if (value_raw === undefined) {
                return 0;
            }

            let value = 0;
            try {
                value = Number.parseInt(value_raw);
            } catch {
                throw new BadRequestException(
                    'QuerySkip is not a valid Number',
                );
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
            parameterName,
            parameterDescription ?? 'Pagination Skip',
            'query',
            'number',
            false,
        ),
    )(parameterName);

const MAX_TAKE = 10_000;
const DEFAULT_TAKE = 100;

export const QueryTake = (
    parameterName: string,

    parameterDescription?: string,
) =>
    createParamDecorator(
        async (data: string, context: ExecutionContext): Promise<number> => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-member-access
            const raw_value = request.query[data] as string | undefined;

            if (raw_value === undefined) {
                return DEFAULT_TAKE; // default value
            }

            let value = 0;
            try {
                value = Number.parseInt(raw_value);
            } catch {
                throw new BadRequestException(
                    'QueryTake is not a valid Number',
                );
            }

            if (value > MAX_TAKE) {
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
            parameterName,
            parameterDescription ?? 'Pagination Take',
            'query',
            'number',
            false,
        ),
    )(parameterName);

export const QueryOptional = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            return value as string;
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'any',
            false,
        ),
    )(parameterName);

export const QueryOptionalRecord = (
    parameterName: string,
    parameterDescription: string,
) =>
    createParamDecorator(
        (data: string, context: ExecutionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request = context.switchToHttp().getRequest();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = request.query[data];

            if (value === undefined) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return JSON.parse(value.replaceAll("'", '"'));
        },
        metadataApplier(
            parameterName,
            parameterDescription,
            'query',
            'Record<unknown, unknown>',
            false,
        ),
    )(parameterName);
