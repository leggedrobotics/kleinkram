import { safeLinkUrl } from '@kleinkram/shared';

describe('safeLinkUrl', () => {
    test.each([
        ['https://example.com', 'https://example.com/'],
        // eslint-disable-next-line unicorn/prefer-https -- plain http is allowed
        ['http://example.com/a?b=c#d', 'http://example.com/a?b=c#d'],
        ['  https://example.com/x  ', 'https://example.com/x'],
        ['HTTPS://Example.com', 'https://example.com/'],
    ])('should accept %p', (input, expected) => {
        expect(safeLinkUrl(input)).toBe(expected);
    });

    test.each([
        'javascript:alert(1)',
        'JaVaScRiPt:alert(1)',
        '\tjavascript:alert(1)',
        'java\nscript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'mailto:a@b.c',
        'example.com',
        '//example.com',
        '/relative/path',
        '',
        ' '.repeat(3),
    ])('should reject %p', (input) => {
        expect(safeLinkUrl(input)).toBeUndefined();
    });

    test('should reject values that are not strings', () => {
        expect(safeLinkUrl(undefined)).toBeUndefined();
        expect(safeLinkUrl(null)).toBeUndefined();
        expect(safeLinkUrl(42)).toBeUndefined();
    });
});
