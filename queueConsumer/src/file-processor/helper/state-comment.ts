/**
 * `stateComment` is returned with every file DTO, so it is shown to anyone who
 * can read the file. Raw processing errors must not reach it unfiltered: they
 * can carry presigned storage URLs (with their signatures), paths inside the
 * worker container, or multi-line stack traces.
 */
export const MAX_STATE_COMMENT_LENGTH = 500;

const URL_PATTERN = /\b[a-z][\d+.a-z-]*:\/\/\S+/gi;

// Absolute paths below a filesystem root, e.g. `/tmp/abc/file.bag`. Only
// these roots are matched because ROS topic names (`/imu/data`) look like
// absolute paths too and are useful in a diagnostic.
const ABSOLUTE_PATH_PATTERN =
    /(?<![\w.:/-])\/(?:app|data|dev|etc|home|mnt|opt|proc|root|run|srv|tmp|usr|var)(?:\/[\w.@+-]+)+\/?/g;

const errorText = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return '';
};

const truncate = (text: string): string =>
    text.length <= MAX_STATE_COMMENT_LENGTH
        ? text
        : `${text.slice(0, MAX_STATE_COMMENT_LENGTH - 1)}…`;

/**
 * Removes the parts of a diagnostic message that must not be shown to users:
 * everything after the first line, URLs, and the directories of absolute paths
 * (the file name is kept, it is usually what the user needs to see).
 */
export const sanitizeStateComment = (message: string): string => {
    const [firstLine = ''] = message.split(/\r?\n/, 1);
    return truncate(
        firstLine
            .replaceAll(URL_PATTERN, '<url>')
            .replaceAll(ABSOLUTE_PATH_PATTERN, (match) => {
                const name = match.replace(/\/$/, '').split('/').pop();
                return name ?? '';
            })
            .trim(),
    );
};

/**
 * Builds the user-facing `stateComment` for a processing failure: a fixed
 * description of what failed, followed by the sanitized error message.
 */
export const toStateComment = (summary: string, error: unknown): string => {
    const detail = sanitizeStateComment(errorText(error));
    return truncate(detail ? `${summary}: ${detail}` : summary);
};
