/**
 * Sends one request per item and reports which items failed, so a retry can
 * leave out the ones that already went through (sending those again would
 * fail, e.g. "already a member").
 *
 * @returns the items whose request failed and the first error, if any
 */
export const runForEach = async <T>(
    items: readonly T[],
    request: (item: T) => Promise<unknown>,
): Promise<{ failed: T[]; error: unknown }> => {
    const results = await Promise.allSettled(
        items.map((item) => request(item)),
    );
    const failed: T[] = [];
    let error: unknown;
    for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') continue;
        failed.push(items[index] as T);
        error ??= result.reason;
    }
    return { failed, error };
};
