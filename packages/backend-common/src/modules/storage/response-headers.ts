/**
 * Response headers a presigned GET is asked to return.
 *
 * Without an explicit content type the storage backend sniffs one from the
 * first bytes of the object, which means a file's own content decides how a
 * browser treats it: a text file that happens to start with `<!DOCTYPE html>`
 * comes back as `text/html` and renders, scripts and all, on the storage
 * origin. Every link handed to a client therefore pins both headers.
 */

/**
 * Deliberately opaque: stored objects are user-supplied bytes, so no link
 * should invite a browser to interpret them.
 */
export const OPAQUE_CONTENT_TYPE = 'application/octet-stream';

/** Characters that would break out of, or corrupt, a quoted header value. */
const UNSAFE_IN_QUOTED_STRING = /["\\]|[\u0000-\u001F\u007F]/g;
const NON_ASCII = /[^\u0020-\u007E]/g;

/**
 * `encodeURIComponent` leaves these four unescaped, but RFC 8187 keeps them out
 * of `attr-char`, so a strict client drops the whole extended parameter and
 * falls back to the lossy ASCII name. `!` and `~` survive encoding too and are
 * deliberately left alone: both are `attr-char`.
 */
const NOT_ATTR_CHAR = /['()*]/g;

const encodeExtendedValue = (value: string): string =>
    encodeURIComponent(value).replaceAll(
        NOT_ATTR_CHAR,
        (character) =>
            `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`,
    );

/**
 * Builds an RFC 6266 `Content-Disposition` value.
 *
 * The plain `filename` parameter may only carry ASCII, so a name with umlauts
 * (which upload validation allows) needs the RFC 5987 `filename*` form beside
 * it; clients that understand only one of the two still get a usable name.
 */
export const contentDisposition = (
    filename: string,
    disposition: 'attachment' | 'inline' = 'attachment',
): string => {
    const sanitized = filename.replaceAll(UNSAFE_IN_QUOTED_STRING, '_');
    const asciiFallback = sanitized.replaceAll(NON_ASCII, '_');
    const encoded = encodeExtendedValue(filename);

    return (
        `${disposition}; filename="${asciiFallback}"; ` +
        `filename*=UTF-8''${encoded}`
    );
};
