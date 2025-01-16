import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadGatewayException,
    ParseUUIDPipe,
} from '@nestjs/common';

@Injectable()
export class ParseStringNotUUIDPipe implements PipeTransform {
    async transform(
        value: string,
        metadata: ArgumentMetadata,
    ): Promise<number> {
        try {
            await new ParseUUIDPipe().transform(value, metadata);
        } catch {
            return new Promise(() => value);
        }
        throw new BadGatewayException('Value is a UUID');
    }
}

@Injectable()
export class ParseOptionalStringNotUUIDPipe
    extends ParseStringNotUUIDPipe
    implements PipeTransform
{
    async transform(
        value: string | undefined | null,
        metadata: ArgumentMetadata,
    ): Promise<number> {
        if (value === undefined || value === null) {
            return new Promise(() => undefined);
        }
        return super.transform(value, metadata);
    }
}
