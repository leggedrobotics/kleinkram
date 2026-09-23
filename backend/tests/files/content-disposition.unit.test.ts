import {
    contentDisposition,
    OPAQUE_CONTENT_TYPE,
} from '@kleinkram/backend-common/modules/storage/response-headers';

/**
 * The header is assembled by hand, so the cases that matter are the ones where
 * a filename carries characters the grammar does not allow: a client that
 * cannot parse the value falls back to the object key, which is a UUID.
 */
describe('contentDisposition', () => {
    test('passes an ordinary name through both parameters', () => {
        expect(contentDisposition('telemetry_run.csv')).toBe(
            'attachment; filename="telemetry_run.csv"; ' +
                "filename*=UTF-8''telemetry_run.csv",
        );
    });

    test('keeps non-ASCII in filename* and degrades the ASCII fallback', () => {
        expect(contentDisposition('Übersicht.md')).toBe(
            'attachment; filename="_bersicht.md"; ' +
                "filename*=UTF-8''%C3%9Cbersicht.md",
        );
    });

    test('escapes characters RFC 8187 excludes from an extended value', () => {
        // Parentheses are allowed by filename validation, and `encodeURIComponent`
        // alone would leave them (and `'`, `*`) raw, which invalidates filename*.
        expect(contentDisposition('häm(1).yaml')).toBe(
            'attachment; filename="h_m(1).yaml"; ' +
                "filename*=UTF-8''h%C3%A4m%281%29.yaml",
        );
        expect(contentDisposition("mörder's*.csv")).toBe(
            'attachment; filename="m_rder\'s*.csv"; ' +
                "filename*=UTF-8''m%C3%B6rder%27s%2A.csv",
        );
    });

    test('leaves attr-chars unescaped', () => {
        expect(contentDisposition('a!b~c.md')).toContain(
            "filename*=UTF-8''a!b~c.md",
        );
    });

    test('neutralises a quote that would otherwise end the parameter', () => {
        const header = contentDisposition('evil";x=".md');

        expect(header).toBe(
            'attachment; filename="evil_;x=_.md"; ' +
                "filename*=UTF-8''evil%22%3Bx%3D%22.md",
        );
        // The only quotes left are the two delimiting the ASCII fallback.
        expect(header.split('"')).toHaveLength(3);
    });

    test('strips control characters that would split the header', () => {
        expect(contentDisposition('a\r\nb.csv')).toBe(
            'attachment; filename="a__b.csv"; ' +
                "filename*=UTF-8''a%0D%0Ab.csv",
        );
    });

    test('supports an inline disposition', () => {
        expect(contentDisposition('notes.md', 'inline')).toBe(
            'inline; filename="notes.md"; filename*=UTF-8\'\'notes.md',
        );
    });

    test('offers a content type no browser will render', () => {
        expect(OPAQUE_CONTENT_TYPE).toBe('application/octet-stream');
    });
});
