/**
 * Run async work over a list with a bounded number of requests in flight,
 * delivering results in input order.
 *
 * Index-driven reads are latency-bound rather than bandwidth-bound: a sampled
 * preview of a dense topic plans hundreds of chunk indexes and then fetches
 * around a thousand small ranges. Issued one at a time that is thousands of
 * sequential round trips, which dominates everything else no matter how few
 * bytes each one moves.
 *
 * Order matters because the caller writes messages out in log-time order, and
 * the cap matters because the alternative -- firing every request at once --
 * would hold the whole selection in memory and bury the storage backend.
 */
export async function* mapInOrder<T, R>(
    items: readonly T[],
    concurrency: number,
    run: (item: T, index: number) => Promise<R>,
): AsyncGenerator<{ item: T; result: R }, void, undefined> {
    if (items.length === 0) return;

    const limit = Math.max(1, Math.min(concurrency, items.length));
    const pending: { item: T; promise: Promise<R> }[] = [];
    let next = 0;

    const submit = (): void => {
        if (next >= items.length) return;
        const index = next++;
        // Guarded by the bound above; `noUncheckedIndexedAccess` cannot see it.
        const item = items[index] as T;
        pending.push({ item, promise: run(item, index) });
    };

    for (let index = 0; index < limit; index++) submit();

    while (pending.length > 0) {
        const entry = pending.shift();
        if (!entry) break;
        const result = await entry.promise;
        submit();
        yield { item: entry.item, result };
    }
}
