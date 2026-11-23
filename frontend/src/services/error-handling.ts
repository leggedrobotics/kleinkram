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

/**
 * The per-field errors of a rejected request, keyed by field, e.g. the
 * metadata type uuid of each invalid metadata value:
 * `{ message, errors: [{ field, error }] }`. Undefined if the response
 * carries none.
 */
export const getFieldErrors = (
    error: unknown,
): Record<string, string> | undefined => {
    if (!isAxiosError(error)) return undefined;
    const data: unknown = error.response?.data;
    const errors = (data as { errors?: unknown } | undefined)?.errors;
    if (!Array.isArray(errors)) return undefined;

    const fieldErrors: Record<string, string> = {};
    for (const entry of errors as unknown[]) {
        const { field, error: message } = (entry ?? {}) as {
            field?: unknown;
            error?: unknown;
        };
        if (typeof field === 'string' && typeof message === 'string')
            fieldErrors[field] = message;
    }
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
};

/**
 * The message for a dialog's error strip: the server's own message, or a
 * hint to retry when the server could not be reached. No "Error …:" prefix,
 * the dialog already says what failed.
 */
export const getDialogErrorMessage = (error: unknown): string => {
    if (isAxiosError(error) && error.response === undefined)
        return 'Could not reach the server. Try again.';
    return getErrorMessage(error);
};

/**
 * Whether the server rejected the name the user entered: a name that is
 * already taken or not allowed. Such errors are shown on the name field, not
 * in the dialog's error strip. Not every 409 is about the name (e.g. missing
 * required metadata), so the message has to say so.
 */
export const isNameError = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    if (status !== 400 && status !== 409) return false;
    return /\bname\b|already exists/i.test(getErrorMessage(error));
};

/** Focuses a field by its id (after the error is rendered) and shows it */
export const focusField = (id: string): void => {
    // the error message renders on the next frame
    requestAnimationFrame(() => {
        const element = document.querySelector<HTMLElement>(
            `#${CSS.escape(id)}`,
        );
        element?.scrollIntoView({ block: 'nearest' });
        element?.focus();
    });
};
