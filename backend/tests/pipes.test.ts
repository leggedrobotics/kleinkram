import { ForEachPipe } from '../src/pipes/for-each.pipe';
import { MetadataPipe } from '../src/pipes/metadata.pipe';
import { ParseNotUUIDPipe } from '../src/pipes/not-uuid.pipe';
import { OptionalPipe } from '../src/pipes/optional.pipe';
import {
    ParseSkipPipe,
    ParseTakePipe,
    DEFAULT_SKIP,
    DEFAULT_TAKE,
    MAX_TAKE,
} from '../src/pipes/pagination.pipe';
import { ArgumentMetadata } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';

describe('not uuid pipe', () => {
    let pipe: ParseNotUUIDPipe;
    let metadata: ArgumentMetadata;

    beforeEach(() => {
        pipe = new ParseNotUUIDPipe();
        metadata = {
            type: 'param',
        };
    });

    it('should work with normal string', async () => {
        const result = await pipe.transform('test', metadata);
        expect(result).toBe('test');
    });

    it('should fail with uuid', async () => {
        try {
            await pipe.transform(
                'c8b1b0b0-1f3a-4c3f-8e8d-1d7b3f3a0b1f',
                metadata,
            );
            fail('should have thrown');
        } catch (e) {
            console.log(e);
        }
    });
});
