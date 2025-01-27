import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadGatewayException,
    ParseUUIDPipe,
} from '@nestjs/common';

@Injectable()
export class ParseNotUUIDPipe implements PipeTransform {
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
