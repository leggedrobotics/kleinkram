import {
    maskSecret,
    redactEnvironment,
} from '../src/actions/helper/redact-environment';

describe('Redact Environment', () => {
    test('should keep variable names and mask every value', () => {
        const redacted = redactEnvironment({
            KLEINKRAM_API_KEY: '0b6c1f2e-secret',

            KLEINKRAM_SCRIPT_URL:
                'https://s3.example/script?X-Amz-Signature=abc',
        });

        expect(redacted).toEqual({
            KLEINKRAM_API_KEY: '***',

            KLEINKRAM_SCRIPT_URL: '***',
        });
        expect(JSON.stringify(redacted)).not.toContain('secret');
        expect(JSON.stringify(redacted)).not.toContain('Signature');
    });

    test('should return an empty object if no environment is given', () => {
        expect(redactEnvironment(undefined)).toEqual({});
    });
});

describe('Mask Secret', () => {
    const key = '0b6c1f2e-4a1d-4c55-9f0e-6f1d2a3b4c5d';

    test('should mask every occurrence of the key in a line', () => {
        const masked = maskSecret(`key=${key} again ${key}`, key);

        expect(masked).toBe('key=*** again ***');
        expect(masked).not.toContain(key);
    });

    test('should leave a line without the key unchanged', () => {
        expect(maskSecret('nothing to hide', key)).toBe('nothing to hide');
    });

    test('should leave the line unchanged if the secret is empty', () => {
        expect(maskSecret('abc', '')).toBe('abc');
    });
});
