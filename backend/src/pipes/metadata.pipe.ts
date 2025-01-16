import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadGatewayException,
} from '@nestjs/common';

const METADATA_INVALID_FORMAT_ERROR =
    'Metadata must be an object with string keys and properties';

@Injectable()
export class ParseOptionalMetadataPipe implements PipeTransform {
    transform(
        value: unknown,
        _: ArgumentMetadata,
    ): Record<string, string> | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        // check that value is of type object with <string, string> properties
        if (
            typeof value !== 'object' ||
            Array.isArray(value) ||
            !Object.entries(value).every(
                ([key, val]) =>
                    typeof key === 'string' && typeof val === 'string',
            )
        ) {
            throw new BadGatewayException(METADATA_INVALID_FORMAT_ERROR);
        } else {
            return value as Record<string, string>;
        }
    }
}
