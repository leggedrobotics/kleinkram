export interface RosTime {
    sec: number;
    nsec: number;
}

/**
 * Wall-clock bounds of the messages contained in a recording.
 *
 * Both ends are optional because a file may carry no usable timestamps at all
 * (an empty recording, or a format we cannot index).
 */
export interface RecordingTimes {
    startDate?: Date;
    endDate?: Date;
}

export function toNanoseconds(time: RosTime | undefined): bigint | undefined {
    if (time === undefined) return undefined;
    return BigInt(time.sec) * 1_000_000_000n + BigInt(time.nsec);
}

export function getDurationSeconds(
    startTimeNs: bigint | undefined,
    endTimeNs: bigint | undefined,
): number {
    if (startTimeNs === undefined || endTimeNs === undefined) return 0;
    const durationNs = endTimeNs - startTimeNs;
    if (durationNs <= 0n) return 0;
    return Number(durationNs / 1_000_000n) / 1000;
}

/**
 * Converts a message timestamp to a `Date`, or to `undefined` when it cannot
 * stand for a point in time.
 *
 * A zero timestamp is not a recording from 1970 but the default an empty
 * recording reports (MCAP statistics of a file without messages hold
 * `messageStartTime === messageEndTime === 0n`). A timestamp beyond the range
 * `Date` can represent is a corrupt statistics record; both are unknown rather
 * than a bound we could hand on.
 */
export function nanosecondsToDate(
    timeNs: bigint | undefined,
): Date | undefined {
    if (timeNs === undefined || timeNs <= 0n) return undefined;

    const date = new Date(Number(timeNs / 1_000_000n));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Builds the recording bounds from the raw message timestamps, dropping an end
 * that lies before the start (which some writers emit for single-message or
 * truncated recordings).
 */
export function toRecordingTimes(
    startTimeNs: bigint | undefined,
    endTimeNs: bigint | undefined,
): RecordingTimes {
    const startDate = nanosecondsToDate(startTimeNs);
    const endDate = nanosecondsToDate(endTimeNs);

    return {
        ...(startDate ? { startDate } : {}),
        ...(endDate && !(startDate && endDate < startDate) ? { endDate } : {}),
    };
}
