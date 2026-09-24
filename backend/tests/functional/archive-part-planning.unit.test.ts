import { planArchiveParts } from '@kleinkram/backend-common/modules/archive-storage/archive-storage';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const files = (...sizes: number[]): { size: number }[] =>
    sizes.map((size) => ({ size }));

const partSizes = (parts: { size: number }[][]): number[] =>
    parts.map((part) => part.reduce((sum, item) => sum + item.size, 0));

describe('Archive Part Planning', () => {
    test('should keep a project below the part size in a single part', () => {
        const parts = planArchiveParts(
            files(
                MB,
                MB,
                MB,
                2 * GB,
                2 * GB,
                2 * GB,
                2 * GB,
                2 * GB,
                180 * MB,
                MB,
                MB,
                MB,
            ),
            100 * GB,
        );
        expect(parts).toHaveLength(1);
    });

    test('should not leave small files in parts of their own next to large files', () => {
        const parts = planArchiveParts(
            files(MB, MB, 3 * GB, 3 * GB, 3 * GB, MB),
            4 * GB,
        );
        // the small files join the large ones instead of forming 1 MB parts
        expect(partSizes(parts)).toEqual([6 * GB + 2 * MB, 3 * GB + MB]);
        expect(parts.flat()).toHaveLength(6);
    });

    test('should fill every part to the part size', () => {
        const parts = planArchiveParts(
            files(...Array.from({ length: 50 }, () => 3 * GB)),
            10 * GB,
        );
        // 150 GB: twelve parts of 12 GB, the 6 GB remainder is big enough
        expect(partSizes(parts)).toEqual([
            ...Array.from({ length: 12 }, () => 12 * GB),
            6 * GB,
        ]);
    });

    test('should fold a small remainder into the previous part', () => {
        const parts = planArchiveParts(
            files(...Array.from({ length: 5 }, () => 3 * GB)),
            10 * GB,
        );
        expect(partSizes(parts)).toEqual([15 * GB]);
    });

    test('should keep small neighbours of a file larger than the part size with it', () => {
        const parts = planArchiveParts(files(GB, 50 * GB, GB), 10 * GB);
        expect(parts).toHaveLength(1);
    });

    test('should split a large project into parts of at least the part size', () => {
        const parts = planArchiveParts(
            files(40 * GB, 40 * GB, 40 * GB, 40 * GB, 40 * GB, 5 * GB),
            100 * GB,
        );
        expect(partSizes(parts)).toEqual([120 * GB, 85 * GB]);
    });

    test('should keep the order of the files', () => {
        const items = files(5 * GB, GB, 7 * GB, 2 * GB, 9 * GB);
        expect(planArchiveParts(items, 8 * GB).flat()).toEqual(items);
    });
});
