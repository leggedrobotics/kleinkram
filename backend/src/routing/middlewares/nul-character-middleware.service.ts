import {
    BadRequestException,
    Injectable,
    NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export const NUL_CHARACTER_MESSAGE = 'Text must not contain NUL characters';

const NUL = '\u0000';

/**
 * Whether a parsed query or JSON body contains a NUL character in any string
 * or object key. Walks the value iteratively, so deeply nested bodies can't
 * overflow the stack.
 */
export const containsNulCharacter = (value: unknown): boolean => {
    const pending: unknown[] = [value];
    while (pending.length > 0) {
        const current = pending.pop();
        if (typeof current === 'string') {
            if (current.includes(NUL)) return true;
        } else if (Array.isArray(current)) {
            // one at a time: spreading a wide array (e.g. 200,000 numbers)
            // into `push` exceeds the argument limit and throws
            for (const entry of current as unknown[]) pending.push(entry);
        } else if (current !== null && typeof current === 'object') {
            for (const [key, nested] of Object.entries(current)) {
                if (key.includes(NUL)) return true;
                pending.push(nested);
            }
        }
    }
    return false;
};

/**
 * The decoded path of a request, or `undefined` if it isn't valid
 * percent-encoding (the router rejects those on its own).
 */
const decodedPath = (request: Request): string | undefined => {
    // `request.path` is relative to the middleware's mount point, so the
    // full path is taken from `originalUrl`
    const path = request.originalUrl.split('?')[0] ?? '';
    try {
        return decodeURIComponent(path);
    } catch {
        return undefined;
    }
};

/**
 * Rejects requests that contain a NUL character (`\u0000`) in the path, the
 * query or the JSON body with 400 Bad Request.
 *
 * PostgreSQL can't store NUL in `text`, `varchar` or `jsonb` and fails the
 * whole query with `invalid byte sequence for encoding "UTF8": 0x00`. No
 * value in Kleinkram may legitimately contain one, so it is refused at the
 * API boundary instead of surfacing as a 500 from deep inside a service.
 */
@Injectable()
export class NulCharacterMiddleware implements NestMiddleware {
    use(request: Request, _response: Response, next: NextFunction): void {
        if (
            decodedPath(request)?.includes(NUL) ||
            containsNulCharacter(request.query) ||
            containsNulCharacter(request.body)
        ) {
            throw new BadRequestException(NUL_CHARACTER_MESSAGE);
        }
        next();
    }
}
