import { FileDto } from '@kleinkram/api-dto';
import { plainToInstance } from 'class-transformer';

/**
 * A file as the query service hands it to `plainToInstance`. Only the fields
 * the recording window is derived from matter here.
 */
const fileWith = (
    recordingStartDate: Date | null,
    recordingEndDate: Date | null,
): Record<string, unknown> => ({
    uuid: '00000000-0000-0000-0000-000000000000',
    filename: 'recording.mcap',
    date: recordingStartDate ?? new Date('2026-09-11T21:12:59.666Z'),
    createdAt: new Date('2026-09-11T21:12:59.666Z'),
    updatedAt: new Date('2026-09-11T21:13:04.000Z'),
    recordingStartDate,
    recordingEndDate,
});

const toDto = (file: Record<string, unknown>): FileDto =>
    plainToInstance(FileDto, file, { excludeExtraneousValues: true });

describe('FileDto recording window', () => {
    test('exposes the recording bounds and their length', () => {
        const dto = toDto(
            fileWith(
                new Date('2026-03-04T10:00:00.000Z'),
                new Date('2026-03-04T10:02:30.500Z'),
            ),
        );

        expect(dto.recordingStartDate).toEqual(
            new Date('2026-03-04T10:00:00.000Z'),
        );
        expect(dto.recordingEndDate).toEqual(
            new Date('2026-03-04T10:02:30.500Z'),
        );
        expect(dto.durationSeconds).toBe(150.5);
    });

    test('keeps the upload time separate from the recording start', () => {
        const dto = toDto(fileWith(new Date('2026-03-04T10:00:00.000Z'), null));

        expect(dto.createdAt).toEqual(new Date('2026-09-11T21:12:59.666Z'));
        expect(dto.recordingStartDate).toEqual(
            new Date('2026-03-04T10:00:00.000Z'),
        );
    });

    /**
     * Files that have not been indexed yet must not report the upload time as
     * a recording start, which is exactly what the header used to show.
     */
    test('reports an unknown recording window as null', () => {
        const dto = toDto(fileWith(null, null));

        expect(dto.recordingStartDate).toBeNull();
        expect(dto.recordingEndDate).toBeNull();
        expect(dto.durationSeconds).toBeNull();
    });

    test('has no length while only one bound is known', () => {
        const dto = toDto(fileWith(new Date('2026-03-04T10:00:00.000Z'), null));

        expect(dto.durationSeconds).toBeNull();
    });

    test('has no length when the bounds are inverted', () => {
        const dto = toDto(
            fileWith(
                new Date('2026-03-04T10:02:30.000Z'),
                new Date('2026-03-04T10:00:00.000Z'),
            ),
        );

        expect(dto.durationSeconds).toBeNull();
    });

    test('parses bounds that arrive as ISO strings', () => {
        const dto = toDto({
            ...fileWith(null, null),
            recordingStartDate: '2026-03-04T10:00:00.000Z',
            recordingEndDate: '2026-03-04T10:00:10.000Z',
        });

        expect(dto.recordingStartDate).toEqual(
            new Date('2026-03-04T10:00:00.000Z'),
        );
        expect(dto.durationSeconds).toBe(10);
    });
});
