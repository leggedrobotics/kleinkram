import { isAxiosError } from 'axios';

/**
 * Message shown when the backend denied a request because the user lacks the
 * required rights. Guards that simply deny access answer with the generic
 * `Forbidden resource` body of NestJS, which is not helpful for the user.
 */
export const INSUFFICIENT_PERMISSIONS_MESSAGE =
    'You do not have permission to perform this action.';

const NEST_DEFAULT_FORBIDDEN_MESSAGE = 'Forbidden resource';

/**
 * The HTTP status code of a failed request, or `undefined` if the error did not
 * originate from an HTTP response (e.g. a network error).
 */
export const getErrorStatus = (error: unknown): number | undefined =>
    isAxiosError(error) ? error.response?.status : undefined;

/**
 * Whether the request was rejected because the user lacks the required rights.
 */
export const isPermissionError = (error: unknown): boolean =>
    getErrorStatus(error) === 403;

/**
 * The message the backend sent alongside a failed request, if any.
 *
 * NestJS reports validation failures as a list of messages, hence both a single
 * string and an array of strings must be handled.
 */
const getResponseMessage = (error: unknown): string | undefined => {
    if (!isAxiosError(error)) return undefined;

    const data: unknown = error.response?.data;
    const message = (data as { message?: unknown } | undefined)?.message;

    if (typeof message === 'string' && message !== '') return message;
    if (Array.isArray(message) && message.length > 0)
        return message.map(String).join(', ');

    return undefined;
};

/**
 * Builds a message describing why a request failed.
 *
 * Permission errors are translated into a readable message unless the backend
 * provided a more specific one, as a denied guard only reports the generic
 * `Forbidden resource`.
 *
 * @param error the error thrown by axios (or anything else)
 * @param fallback message used if no message can be extracted
 */
export const getErrorMessage = (
    error: unknown,
    fallback = 'Unknown error occurred',
): string => {
    const responseMessage = getResponseMessage(error);

    if (isPermissionError(error))
        return responseMessage === undefined ||
            responseMessage === NEST_DEFAULT_FORBIDDEN_MESSAGE
            ? INSUFFICIENT_PERMISSIONS_MESSAGE
            : responseMessage;

    if (responseMessage !== undefined) return responseMessage;
    if (error instanceof Error && error.message !== '') return error.message;

    return fallback;
};
