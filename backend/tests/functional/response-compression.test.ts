import { DEFAULT_URL } from '../auth/utilities';

/**
 * Uses the OpenAPI document as a large response that needs no
 * authentication. `fetch` decompresses the body transparently but keeps the
 * `content-encoding` header, so the header shows what the server sent.
 */
const LARGE_ENDPOINT = `${DEFAULT_URL}/swagger/json`;
const SMALL_ENDPOINT = `${DEFAULT_URL}/api/health`;

function acceptEncoding(value: string): Headers {
    return new Headers([['Accept-Encoding', value]]);
}

describe('API Response Compression', () => {
    test('should gzip large responses if the client accepts gzip', async () => {
        const response = await fetch(LARGE_ENDPOINT, {
            headers: acceptEncoding('gzip'),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-encoding')).toBe('gzip');
        expect(response.headers.get('vary')).toMatch(/accept-encoding/i);
        // the body must still decode to valid JSON
        const body = (await response.json()) as { openapi?: string };
        expect(body.openapi).toBeDefined();
    });

    test('should use Brotli if the client prefers it', async () => {
        const response = await fetch(LARGE_ENDPOINT, {
            headers: acceptEncoding('br, gzip'),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-encoding')).toBe('br');
    });

    test('should not compress if the client does not accept compression', async () => {
        const response = await fetch(LARGE_ENDPOINT, {
            headers: acceptEncoding('identity'),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-encoding')).toBeNull();
    });

    test('should not compress responses below the size threshold', async () => {
        const response = await fetch(SMALL_ENDPOINT, {
            headers: acceptEncoding('gzip'),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-encoding')).toBeNull();
    });
});
