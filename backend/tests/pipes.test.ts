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

    it('should work on a regular string', async () => {
        expect(await pipe.transform('not-uuid', metadata)).toBe('not-uuid');
    });

    it('should throw an error if its a uuid', async () => {
        await expect(async () => {
            await pipe.transform(
                '550e8400-e29b-41d4-a716-446655440000',
                metadata,
            );
        }).rejects.toThrow();
    });
});

describe('metadata pipe', () => {
    let pipe: MetadataPipe;
    let metadata: ArgumentMetadata;

    beforeEach(() => {
        pipe = new MetadataPipe();
        metadata = {
            type: 'param',
        };
    });

    it('should work with Record<string, string>', () => {
        expect(pipe.transform({ key: 'value' }, metadata)).toEqual({
            key: 'value',
        });
    });

    it('should throw an error if its not an object', () => {
        expect(() => pipe.transform('not an object', metadata)).toThrow();
    });

    it('should throw an error if its an array', () => {
        expect(() => pipe.transform(['array'], metadata)).toThrow();
    });

    it('should throw an error if value is not a string', () => {
        expect(() => pipe.transform({ key: 1 }, metadata)).toThrow();
    });

    it('should throw an error if key is not a string', () => {
        expect(() => pipe.transform({ 1: 'value' }, metadata)).toThrow();
    });
});

describe('optional pipe', () => {
    let pipe: OptionalPipe<ParseIntPipe>;
    let metadata: ArgumentMetadata;

    beforeEach(() => {
        pipe = new OptionalPipe(new ParseIntPipe());
        metadata = {
            type: 'param',
        };
    });

    it('should work with a value', async () => {
        expect(await pipe.transform('1', metadata)).toBe(1);
    });

    it('should faile if value is not a number', async () => {
        await expect(
            async () => await pipe.transform('not a number', metadata),
        ).rejects.toThrow();
    });

    it('should work with undefined', async () => {
        expect(await pipe.transform(undefined, metadata)).toBe(undefined);
    });

    it('should work with null', async () => {
        expect(await pipe.transform(null, metadata)).toBe(undefined);
    });
});

describe('pagination pipes', () => {
    let skipPipe: ParseSkipPipe;
    let takePipe: ParseTakePipe;

    let metadata: ArgumentMetadata;

    beforeEach(() => {
        skipPipe = new ParseSkipPipe();
        takePipe = new ParseTakePipe();
        metadata = {
            type: 'param',
        };
    });

    it('should work with a value', async () => {
        await expect(
            async () => await skipPipe.transform('1', metadata),
        ).resolves.toBe(1);
        await expect(
            async () => await takePipe.transform('1', metadata),
        ).resolves.toBe(1);
    });

    it('should work with undefined', async () => {
        await expect(
            async () => await skipPipe.transform(undefined, metadata),
        ).resolves.toBe(DEFAULT_SKIP);
        await expect(
            async () => await takePipe.transform(undefined, metadata),
        ).resolves.toBe(DEFAULT_TAKE);
    });

    it('should work with null', async () => {
        await expect(
            async () => await skipPipe.transform(null, metadata),
        ).resolves.toBe(DEFAULT_SKIP);
        await expect(
            async () => await takePipe.transform(null, metadata),
        ).resolves.toBe(DEFAULT_TAKE);
    });

    it('should throw an error if skip is negative', async () => {
        await expect(
            async () => await skipPipe.transform('-1', metadata),
        ).rejects.toThrow();
    });

    it('should throw an error if take is negative', async () => {
        await expect(
            async () => await takePipe.transform('-1', metadata),
        ).rejects.toThrow();
    });

    it('should throw an error if take is greater than MAX_TAKE', async () => {
        await expect(
            async () => await takePipe.transform(`${MAX_TAKE + 1}`, metadata),
        ).rejects.toThrow();
    });

    it('should work with MAX_TAKE', async () => {
        await expect(
            async () => await takePipe.transform(`${MAX_TAKE}`, metadata),
        ).resolves.toBe(MAX_TAKE);
    });
});

describe('for each pipe', () => {
    let pipe: ForEachPipe;
    let metadata: ArgumentMetadata;

    beforeEach(() => {
        pipe = new ForEachPipe(new ParseIntPipe());
        metadata = {
            type: 'param',
        };
    });

    it('should work with correct values', async () => {
        await expect(
            async () => await pipe.transform(['1', '2', '3'], metadata),
        ).resolves.toEqual([1, 2, 3]);
    });

    it('should not work with undefined', async () => {
        await expect(
            async () => await pipe.transform(undefined, metadata),
        ).rejects.toThrow();
    });

    it('should not work with null', async () => {
        await expect(
            async () => await pipe.transform(null, metadata),
        ).rejects.toThrow();
    });

    it('should work with a single value', async () => {
        await expect(
            async () => await pipe.transform('1', metadata),
        ).resolves.toEqual([1]);
    });

    it('should fail if not all values are correct', async () => {
        await expect(
            async () =>
                await pipe.transform(['1', '2', 'not a number'], metadata),
        ).rejects.toThrow();
    });

    it('should fail if all are incorrect', async () => {
        await expect(
            async () =>
                await pipe.transform(
                    ['not a number', 'not a number', 'not a number'],
                    metadata,
                ),
        ).rejects.toThrow();
    });

    it('should work with an empty array', async () => {
        await expect(
            async () => await pipe.transform([], metadata),
        ).resolves.toEqual([]);
    });
});
