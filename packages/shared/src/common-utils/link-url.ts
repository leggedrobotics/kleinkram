/** The URL schemes a metadata value of type LINK may use. */
export const LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * The normalized URL of a LINK metadata value, or `undefined` if the value is
 * not an absolute `http:` or `https:` URL.
 *
 * Metadata values are user input, so `javascript:`, `data:` and friends must
 * never reach an `href` or `window.open`. The backend rejects them on write and
 * the frontend checks again on read, as older rows may predate the check.
 */
export function safeLinkUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    try {
        const url = new URL(value.trim());
        return LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}
