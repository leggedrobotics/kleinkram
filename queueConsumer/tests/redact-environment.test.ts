import { redactEnvironment } from '../src/actions/helper/redact-environment';

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
