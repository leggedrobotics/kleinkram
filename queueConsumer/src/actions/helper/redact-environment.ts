/**
 * Returns a copy of a container environment that is safe to log: the names
 * stay, every value is replaced.
 *
 * Action containers receive secrets through their environment
 * (`KLEINKRAM_API_KEY`, the presigned `KLEINKRAM_SCRIPT_URL`), and the queue
 * consumer logger ships every level, debug included, to Loki. Values are
 * masked wholesale rather than by name so that a variable added later cannot
 * leak by default.
 */
export const redactEnvironment = (
    environment: Readonly<Record<string, string>> | undefined,
): Record<string, string> =>
    Object.fromEntries(
        Object.keys(environment ?? {}).map((key) => [key, '***']),
    );

/**
 * Replaces every occurrence of `secret` in `text` with `***`. Used on action
 * container output, which may print its own API key more than once per line.
 */
export const maskSecret = (text: string, secret: string): string =>
    secret === '' ? text : text.replaceAll(secret, '***');
