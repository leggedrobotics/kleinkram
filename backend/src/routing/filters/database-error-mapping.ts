import { EntityPropertyNotFoundError, QueryFailedError } from 'typeorm';

export interface MappedDatabaseError {
    status: 400 | 409;
    message: string;
    /** Server-side detail for the log, never sent to the client. */
    logDetail: string;
}

interface PostgresDriverError {
    code?: unknown;
    detail?: unknown;
    message?: unknown;
}

/**
 * Maps a database error that a client request caused to a 4xx response.
 *
 * This is a safety net: services should check their input and conflicts
 * themselves and throw a specific `HttpException` with a helpful message.
 * Whatever slips through is still the client's fault, not a server error, so
 * it is answered with a generic 400 or 409 instead of a 500.
 *
 * The mapping uses the Postgres SQLSTATE code, never the message text. The
 * client only gets a generic message: the database's message and detail name
 * tables, columns and values and are only logged.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 * @returns the response to send, or `undefined` if the error is a real
 * server error that must stay a 500
 */
export const mapDatabaseError = (
    exception: Error,
): MappedDatabaseError | undefined => {
    if (exception instanceof EntityPropertyNotFoundError) {
        // e.g. an unknown `sortBy` column that reached a find option
        return {
            status: 400,
            message: 'Unknown property in request',
            logDetail: exception.message,
        };
    }

    if (!(exception instanceof QueryFailedError)) return undefined;

    const driverError = exception.driverError as
        PostgresDriverError | undefined;
    const code = typeof driverError?.code === 'string' ? driverError.code : '';
    const detail =
        typeof driverError?.detail === 'string' ? driverError.detail : '';
    const logDetail = `${code} ${exception.message} ${detail}`.trim();

    // 23505 unique_violation: the name (or other unique key) is taken
    if (code === '23505') {
        return { status: 409, message: 'Already exists', logDetail };
    }

    // 23503 foreign_key_violation: on delete, rows still point at the
    // row ("is still referenced"); on insert or update, the referenced row
    // doesn't exist ("is not present")
    if (code === '23503') {
        return detail.includes('is still referenced')
            ? { status: 409, message: 'Still in use', logDetail }
            : {
                  status: 400,
                  message: 'Referenced resource does not exist',
                  logDetail,
              };
    }

    // 23502 not_null_violation: a required value is missing
    if (code === '23502') {
        return { status: 400, message: 'Missing required value', logDetail };
    }

    // class 22 data_exception: a value the column can't hold (malformed
    // uuid, enum or date, number out of range, NUL character, negative
    // LIMIT/OFFSET, ...)
    if (code.startsWith('22')) {
        const message = exception.message.includes(
            'invalid input syntax for type uuid',
        )
            ? 'Invalid UUID'
            : 'Invalid value in request';
        return { status: 400, message, logDetail };
    }

    return undefined;
};
