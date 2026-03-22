export interface RosTime {
    sec: number;
    nsec: number;
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
