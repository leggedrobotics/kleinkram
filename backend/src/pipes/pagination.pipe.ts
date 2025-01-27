import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadGatewayException,
    ParseIntPipe,
} from '@nestjs/common';

export const MAX_TAKE = 10_000;
export const DEFAULT_SKIP = 100;
export const DEFAULT_TAKE = 100;

const SKIP_INVALID_ERROR = 'Skip must be a non-negative integer';
const TAKE_INVALID_ERROR = `Take must be a non-negative integer less than or equal to ${MAX_TAKE}`;

@Injectable()
export class ParseSkipPipe implements PipeTransform {
    async transform(
        value: string | undefined | null,
        metadata: ArgumentMetadata,
    ): Promise<number> {
        if (value === undefined || value === null) {
            return DEFAULT_SKIP;
        }
        const parsedValue = await new ParseIntPipe().transform(value, metadata);
        if (parsedValue < 0) {
            throw new BadGatewayException(SKIP_INVALID_ERROR);
        } else {
            return parsedValue;
        }
    }
}

@Injectable()
export class ParseTakePipe implements PipeTransform {
    async transform(
        value: string | undefined | null,
        metadata: ArgumentMetadata,
    ): Promise<number> {
        if (value === undefined || value === null) {
            return DEFAULT_TAKE;
        }
        const parsedValue = await new ParseIntPipe().transform(value, metadata);
        if (parsedValue < 0 || parsedValue > MAX_TAKE) {
            throw new BadGatewayException(TAKE_INVALID_ERROR);
        } else {
            return parsedValue;
        }
    }
}
