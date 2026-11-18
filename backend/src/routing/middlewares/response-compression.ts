import compression from 'compression';
import type { Request, RequestHandler, Response } from 'express';

/**
 * Responses smaller than this are sent uncompressed: below roughly one TCP
 * packet the encoding overhead outweighs the saved bytes.
 */
export const COMPRESSION_THRESHOLD_BYTES = 1024;

/**
 * Request header that lets a client opt out of compression for one request.
 */
export const NO_COMPRESSION_HEADER = 'x-no-compression';

/**
 * Decides whether a response may be compressed.
 *
 * Server-sent events are never compressed: the middleware buffers output
 * until a compression block is full, which would hold back individual events.
 * Everything else falls back to the default filter of the `compression`
 * package, which only compresses compressible content types.
 */
export function shouldCompress(request: Request, response: Response): boolean {
    if (request.headers[NO_COMPRESSION_HEADER] !== undefined) {
        return false;
    }

    const contentType = response.getHeader('Content-Type');
    if (
        typeof contentType === 'string' &&
        contentType.startsWith('text/event-stream')
    ) {
        return false;
    }

    return compression.filter(request, response);
}

/**
 * Creates the middleware that compresses API responses (Brotli or gzip,
 * depending on the client's `Accept-Encoding` header).
 *
 * Operators running a reverse proxy that already compresses can turn it off
 * with `API_COMPRESSION_ENABLED=false`.
 */
export function responseCompression(): RequestHandler {
    return compression({
        threshold: COMPRESSION_THRESHOLD_BYTES,
        filter: shouldCompress,
    });
}
