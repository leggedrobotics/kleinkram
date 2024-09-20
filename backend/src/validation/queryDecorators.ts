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

export const QueryUUID = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];
        const object = plainToInstance(UUIDValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException(
                `Parameter ${data} is not a valid UUID`,
            );
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
            throw new BadRequestException(
                `Parameter ${data} is not a valid UUID`,
            );
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
            throw new BadRequestException(
                `Parameter ${data} is not a valid String`,
            );
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
            throw new BadRequestException(
                `Parameter ${data} is not a valid String`,
            );
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
                `Parameter ${data} is not a valid String Array`,
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
);

export const QueryDate = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return new Date(0);
        }

        const object = plainToInstance(DateStringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException(
                `Parameter ${data} is not a valid Date`,
            );
        });

        return value;
    },
);

export const QueryProjectSortBy = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === '' || value === undefined) {
            return 'uuid'; // default value
        }

        // check if value is a valid field
        const fields = ['uuid', 'name', 'description', 'creator', 'createdAt'];

        if (!fields.includes(value)) {
            throw new BadRequestException('Parameter is not a valid field');
        }

        const object = plainToInstance(StringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Number');
        });

        return value;
    },
);

export const QueryProjectSearchParam = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
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
        Object.keys(value).forEach((key) => {
            if (value[key] === '') {
                delete value[key];
            }
        });

        // check if every value is a string
        Object.keys(value).forEach((key) => {
            if (typeof value[key] !== 'string') {
                throw new BadRequestException('Parameter is not a valid value');
            }
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
        const object = plainToInstance(DateStringValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException(
                `Parameter ${data} is not a valid Date`,
            );
        });

        return value;
    },
);

export const QueryOptionalNumber = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        const object = plainToInstance(NumberValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Number');
        });

        return value;
    },
);

export const QuerySkip = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return 0;
        }

        const object = plainToInstance(NumberValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Number');
        });

        return value;
    },
);

export const QueryTake = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return 100; // default value
        }

        const object = plainToInstance(NumberValidate, { value });
        await validateOrReject(object).catch((errors) => {
            throw new BadRequestException('Parameter is not a valid Number');
        });

        return value;
    },
);

export const QueryOptional = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        return value;
    },
);

export const QueryOptionalRecord = createParamDecorator(
    async (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const value = request.query[data];

        if (value === undefined) {
            return;
        }

        return JSON.parse(value.replace(/'/g, '"'));
    },
);
