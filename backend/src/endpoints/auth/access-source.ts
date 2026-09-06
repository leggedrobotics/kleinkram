import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import logger from '../../logger';

/**
 * Metadata key under which a route declares where the guard has to read the
 * uuid of the resource it authorizes against.
 */
export const ACCESS_SOURCE_METADATA_KEY = 'accessSource';

/**
 * The part of the request a resource uuid is read from.
 *
 * `param` refers to a route parameter (`/files/:uuid`), `query` to a query
 * string parameter (`?uuid=...`) and `body` to a property of the (JSON) request
 * body.
 */
export type AccessSourceLocation = 'param' | 'query' | 'body';

/**
 * Declares the exact location of the resource uuid an access guard authorizes
 * against.
 *
 * Guards must never fall back to another location: doing so allows a caller to
 * point the guard at a resource they may access while the handler operates on a
 * different one (e.g. `DELETE /files?uuid=<readable>` with a body naming
 * another mission).
 */
export interface AccessSource {
    from: AccessSourceLocation;
    key: string;
}

/**
 * The uuid lives in the route parameter `key` (default `uuid`).
 */
export const fromParameter = (key = 'uuid'): AccessSource => ({
    from: 'param',
    key,
});

/**
 * The uuid lives in the query string parameter `key`.
 */
export const fromQuery = (key: string): AccessSource => ({
    from: 'query',
    key,
});

/**
 * The uuid lives in the request body property `key`.
 */
export const fromBody = (key: string): AccessSource => ({
    from: 'body',
    key,
});

const pickContainer = (
    request: Request,
    from: AccessSourceLocation,
): Record<string, unknown> | undefined => {
    switch (from) {
        case 'param': {
            return request.params as Record<string, unknown> | undefined;
        }
        case 'query': {
            return request.query as Record<string, unknown> | undefined;
        }
        case 'body': {
            return request.body as Record<string, unknown> | undefined;
        }
    }
};

/**
 * Reads the resource uuid from the single location the route declared through
 * its access decorator.
 *
 * Returns `undefined` when the route did not declare a source (which is a
 * programming error and must result in denied access) or when the declared
 * location does not hold a string value.
 */
export const resolveAccessUuid = (
    reflector: Reflector,
    context: ExecutionContext,
    request: Request,
): string | undefined => {
    const source = reflector.get<AccessSource | undefined>(
        ACCESS_SOURCE_METADATA_KEY,
        context.getHandler(),
    );

    if (!source) {
        logger.error(
            `Route ${context.getClass().name}.${context.getHandler().name} is guarded ` +
                `but does not declare an '${ACCESS_SOURCE_METADATA_KEY}'. Denying access.`,
        );
        return undefined;
    }

    const value = pickContainer(request, source.from)?.[source.key];
    return typeof value === 'string' ? value : undefined;
};
