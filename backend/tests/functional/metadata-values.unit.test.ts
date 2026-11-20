/* eslint-disable @typescript-eslint/naming-convention -- the database column names */
import { parseMetadataValue } from '@/services/metadata-values';
import { DataType } from '@kleinkram/shared';

describe('Metadata Values', () => {
    test.each([
        [DataType.NUMBER, '1.5', { value_number: 1.5 }],
        [DataType.NUMBER, 42, { value_number: 42 }],
        [DataType.NUMBER, ' -3 ', { value_number: -3 }],
        [DataType.BOOLEAN, true, { value_boolean: true }],
        [DataType.BOOLEAN, 'False', { value_boolean: false }],
        [DataType.STRING, 'forest', { value_string: 'forest' }],
        [
            DataType.LINK,
            'https://example.com',
            { value_string: 'https://example.com' },
        ],
        [DataType.LOCATION, 'Zurich', { value_location: 'Zurich' }],
    ])('should accept %s value %j', (datatype, value, columns) => {
        expect(parseMetadataValue('m', datatype, value)).toEqual({
            ok: true,
            columns,
        });
    });

    test.each([
        '2024-02-29',
        '2024-05-13T10:30',
        '2024-05-13T10:30:00.000Z',
        '2024-05-13T10:30:00+02:00',
    ])('should accept the ISO date %s', (value) => {
        expect(parseMetadataValue('m', DataType.DATE, value).ok).toBe(true);
    });

    test('should accept an ISO date', () => {
        const parsed = parseMetadataValue('m', DataType.DATE, '2024-05-13');
        expect(parsed.ok && parsed.columns.value_date?.toISOString()).toBe(
            '2024-05-13T00:00:00.000Z',
        );
    });

    test.each([
        [DataType.NUMBER, 'abc', 'a number'],
        [DataType.NUMBER, '', 'a number'],
        [DataType.NUMBER, true, 'a number'],
        [DataType.BOOLEAN, 'maybe', 'true or false'],
        [DataType.BOOLEAN, 1, 'true or false'],
        [DataType.DATE, '13.05.2024', 'a date like 2024-05-13'],
        [DataType.DATE, '05/13/2024', 'a date like 2024-05-13'],
        [DataType.DATE, '2024-02-30', 'a date like 2024-05-13'],
        [DataType.DATE, '2023-02-29', 'a date like 2024-05-13'],
        [DataType.DATE, '2024-13-01', 'a date like 2024-05-13'],
        [DataType.DATE, '', 'a date like 2024-05-13'],
        [DataType.STRING, 5, 'text'],
        [
            DataType.LINK,
            'javascript:alert(1)',
            'an absolute http:// or https:// URL',
        ],
    ])('should reject %s value %j', (datatype, value, expectation) => {
        expect(parseMetadataValue('speed', datatype, value)).toEqual({
            ok: false,
            error: `Metadata "speed" must be ${expectation}`,
        });
    });

    test('should reject values of a type that cannot hold any', () => {
        expect(parseMetadataValue('m', DataType.ANY, 'x').ok).toBe(false);
    });
});
