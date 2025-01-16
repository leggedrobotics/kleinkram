import {
    PipeTransform,
    ArgumentMetadata,
    BadRequestException,
} from '@nestjs/common';

const INVALID_ORDER_BY_ERROR = 'Invalid orderBy format, example';

export enum OrderByDirection {
    ASC = 'asc',
    DESC = 'desc',
}

export class ParseOrderByPipe implements PipeTransform {
    constructor(private readonly columns: string[]) {}
    transform(
        value: any,
        metadata: ArgumentMetadata,
    ): Record<string, OrderByDirection> | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        // check that value is of type object with <string, string> properties
        if (
            typeof value !== 'object' ||
            Array.isArray(value) ||
            !Object.entries(value).every(
                ([key, val]) =>
                    typeof key === 'string' &&
                    typeof val === 'string' &&
                    this.columns.includes(key) &&
                    (val === OrderByDirection.ASC ||
                        val === OrderByDirection.DESC),
            )
        ) {
            throw new BadRequestException(INVALID_ORDER_BY_ERROR);
        } else {
            var result = {} as Record<string, OrderByDirection>;
            for (const [key, val] of Object.entries(value)) {
                result[key] = val as OrderByDirection;
            }
            return result;
        }
    }
}
