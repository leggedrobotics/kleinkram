import { toObjectTagValue } from '@kleinkram/backend-common';

describe('S3 object tag values', () => {
    test('should keep the characters S3 allows in tag values', () => {
        expect(toObjectTagValue('run_01.2024-05-14 a:b/c=d+e@f.mcap')).toBe(
            'run_01.2024-05-14 a:b/c=d+e@f.mcap',
        );
        expect(toObjectTagValue('Messfahrt_Zürich.bag')).toBe(
            'Messfahrt_Zürich.bag',
        );
    });

    test('should replace the characters of names from before the naming rules', () => {
        expect(toObjectTagValue('log(1).bag')).toBe('log_1_.bag');
        expect(toObjectTagValue('scan[2].mcap')).toBe('scan_2_.mcap');
    });

    test('should cut values to 256 characters', () => {
        expect(toObjectTagValue('a'.repeat(300))).toHaveLength(256);
    });
});
