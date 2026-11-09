import { ServiceUnavailableException } from '@nestjs/common';

/**
 * A request could not be served because a backing service is temporarily
 * unavailable — the request itself was fine and retrying it is expected to
 * work.
 *
 * This is deliberately a 503 and not a 409: a 409 tells the client that its
 * request conflicts with the state of the server, which sends people looking
 * for a problem in the payload they just sent.
 */
export class DependencyUnavailableException extends ServiceUnavailableException {
    constructor(
        /** Human readable name of the unavailable service, e.g. `Loki`. */
        readonly dependency: string,
        message: string,
        /** Seconds the client should wait before retrying. */
        readonly retryAfterSeconds: number,
    ) {
        super({
            statusCode: 503,
            error: 'Service Unavailable',
            message,
            dependency,
            retryAfterSeconds,
        });
    }
}
