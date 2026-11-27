import {
    decodeNovatelPosition,
    decodeNovatelVersion,
    decodeTextSample,
    detectLogFormat,
    gpsToUnixMs,
    hasValidGpsTime,
    LOG_SAMPLE_BYTES,
    LogFormat,
    NovatelFraming,
    NovatelPosition,
    NovatelReceiver,
    scanNovatelFrames,
} from '@kleinkram/shared';

/**
 * Reads `length` bytes from `start` with a Range request. Stops reading at the
 * length even if the storage backend ignores the header and sends everything.
 * Returns undefined when the request fails, or when a range past the start of
 * the file is answered with the whole object (reading up to the offset would
 * pull the file we are trying not to download).
 */
export async function fetchByteRange(
    url: string,
    start: number,
    length: number,
): Promise<Uint8Array | undefined> {
    if (length <= 0) return new Uint8Array(0);
    const response = await fetch(url, {
        headers: {
            Range: `bytes=${String(start)}-${String(start + length - 1)}`,
        },
    });
    if (!response.ok) return undefined;
    if (start > 0 && response.status !== 206) {
        await response.body?.cancel();
        return undefined;
    }

    const bytes = new Uint8Array(length);
    let received = 0;
    const reader = response.body?.getReader();
    if (reader) {
        while (received < length) {
            const { done, value } = await reader.read();
            if (done) break;
            const take = Math.min(value.length, length - received);
            bytes.set(value.subarray(0, take), received);
            received += take;
        }
        await reader.cancel();
    } else {
        const whole = new Uint8Array(await response.arrayBuffer());
        const take = Math.min(whole.length, length);
        bytes.set(whole.subarray(0, take));
        received = take;
    }
    return bytes.subarray(0, received);
}

/** Reads the first bytes of a `.log` file and tells which viewer it needs. */
export async function detectRemoteLogFormat(
    url: string,
    size: number,
): Promise<LogFormat | undefined> {
    const sample = await fetchByteRange(url, 0, LOG_SAMPLE_BYTES);
    if (!sample) return undefined;
    return detectLogFormat(sample, size <= sample.length);
}

// --- Text logs ---

/** Bytes of a text log shown at once, the same cap as the other text previews. */
export const TEXT_LOG_WINDOW_BYTES = 2 * 1024 * 1024;

export interface TextLogWindow {
    text: string;
    /** Byte range shown. */
    start: number;
    end: number;
}

/**
 * The first or the last `TEXT_LOG_WINDOW_BYTES` of a text log. A window that
 * starts or ends inside the file drops the partial line at its cut.
 */
export async function fetchTextLogWindow(
    url: string,
    size: number,
    part: 'start' | 'end',
): Promise<TextLogWindow | undefined> {
    const length = Math.min(size, TEXT_LOG_WINDOW_BYTES);
    const start = part === 'end' ? size - length : 0;
    const bytes = await fetchByteRange(url, start, length);
    if (!bytes) return undefined;

    const end = start + bytes.length;
    const cutAtEnd = end < size;
    const cutAtStart = start > 0;

    let body = bytes;
    let droppedAtStart = 0;
    if (cutAtStart) {
        const newline = body.indexOf(0x0a);
        if (newline !== -1) {
            droppedAtStart = newline + 1;
            body = body.subarray(droppedAtStart);
        }
    }
    if (cutAtEnd) {
        const newline = body.lastIndexOf(0x0a);
        if (newline !== -1) body = body.subarray(0, newline + 1);
    }
    return {
        text: decodeTextSample(body, cutAtEnd),
        start: start + droppedAtStart,
        end,
    };
}

// --- NovAtel receiver logs ---

/** Read in full: message statistics and receiver details come from here. */
const NOVATEL_HEAD_BYTES = 4 * 1024 * 1024;
/** Windows sampled across the rest of a large log for the track. */
const NOVATEL_SAMPLE_WINDOWS = 24;
const NOVATEL_SAMPLE_BYTES = 128 * 1024;
const NOVATEL_SAMPLE_CONCURRENCY = 4;
/** Track points kept for the map; more adds nothing a preview can show. */
const MAX_TRACK_POINTS = 4000;

/** Preferred position source first: INS output beats the GNSS-only fix. */
const POSITION_SOURCES = [
    'INSPVAX',
    'INSPVA',
    'INSPVAS',
    'BESTPOS',
    'BESTGNSSPOS',
    'PSRPOS',
    'PPPPOS',
];

export interface NovatelMessageStats {
    name: string;
    id?: number | undefined;
    framing: NovatelFraming;
    count: number;
    /** Messages per second over the span they were seen in, if measurable. */
    rate?: number | undefined;
}

export interface NovatelTrackPoint extends NovatelPosition {
    /** Positions were skipped before this one (between sampled windows). */
    gapBefore?: boolean;
}

export interface NovatelSummary {
    receiver?: NovatelReceiver | undefined;
    /** Unix ms of the first and last valid GPS time seen. */
    startTime?: number | undefined;
    endTime?: number | undefined;
    messages: NovatelMessageStats[];
    messageCount: number;
    /** Bytes the statistics were taken from (the whole file if not truncated). */
    scannedBytes: number;
    truncated: boolean;
    /** Message the track was taken from, e.g. INSPVAX. */
    trackSource?: string | undefined;
    track: NovatelTrackPoint[];
    /** Last decoded position, for the solution status. */
    latest?: NovatelTrackPoint | undefined;
}

interface WindowResult {
    positions: (NovatelPosition & { source: string })[];
    firstTime?: number;
    lastTime?: number;
}

const frameTime = (
    frame: Parameters<typeof hasValidGpsTime>[0],
): number | undefined =>
    hasValidGpsTime(frame)
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          gpsToUnixMs(frame.week!, frame.milliseconds!)
        : undefined;

const scanWindow = (bytes: Uint8Array): WindowResult => {
    const { frames } = scanNovatelFrames(bytes);
    const result: WindowResult = { positions: [] };
    for (const frame of frames) {
        const time = frameTime(frame);
        if (time !== undefined) {
            result.firstTime ??= time;
            result.lastTime = time;
        }
        const position = decodeNovatelPosition(bytes, frame);
        if (position) result.positions.push(position);
    }
    return result;
};

const keyOf = (framing: NovatelFraming, name: string): string =>
    `${framing}:${name}`;

/** Runs `tasks` with at most `limit` in flight, keeping their order. */
async function inBatches<T>(
    tasks: (() => Promise<T>)[],
    limit: number,
): Promise<T[]> {
    const results: T[] = Array.from({ length: tasks.length });
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < tasks.length) {
            const index = next++;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            results[index] = await tasks[index]!();
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, tasks.length) }, worker),
    );
    return results;
}

/** Every n-th point, keeping the mark of a gap that falls between two kept ones. */
const thin = (
    points: NovatelTrackPoint[],
    max: number,
): NovatelTrackPoint[] => {
    if (points.length <= max) return points;
    const stride = points.length / max;
    const kept: NovatelTrackPoint[] = [];
    let previous = -1;
    for (let index = 0; index < max; index++) {
        const at = Math.floor(index * stride);
        const gap = points
            .slice(previous + 1, at + 1)
            .some((point) => point.gapBefore);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        kept.push({ ...points[at]!, gapBefore: index > 0 && gap });
        previous = at;
    }
    return kept;
};

/**
 * Small windows spread over the bytes after the head, the last one ending at
 * the end of the file. Each starts mid-message and resynchronises.
 */
async function sampleWindows(
    url: string,
    from: number,
    size: number,
): Promise<WindowResult[]> {
    const rest = size - from;
    const offsets =
        rest <= NOVATEL_SAMPLE_BYTES
            ? [from]
            : Array.from(
                  { length: NOVATEL_SAMPLE_WINDOWS },
                  (_, index) =>
                      from +
                      Math.floor(
                          ((index + 1) * (rest - NOVATEL_SAMPLE_BYTES)) /
                              NOVATEL_SAMPLE_WINDOWS,
                      ),
              );
    const sampled = await inBatches(
        offsets.map(
            (offset) => async () =>
                fetchByteRange(url, offset, NOVATEL_SAMPLE_BYTES),
        ),
        NOVATEL_SAMPLE_CONCURRENCY,
    );
    return sampled
        .filter((bytes): bytes is Uint8Array => bytes !== undefined)
        .map((bytes) => scanWindow(bytes));
}

/**
 * One source for the whole track: mixing INS and GNSS-only fixes would
 * zig-zag between two solutions of the same antenna. Each list after the
 * first is a separate window, so its first point follows a gap.
 */
const buildTrack = (
    lists: (NovatelPosition & { source: string })[][],
): { trackSource: string | undefined; track: NovatelTrackPoint[] } => {
    const trackSource = POSITION_SOURCES.find((source) =>
        lists.some((list) =>
            list.some((position) => position.source === source),
        ),
    );
    const track: NovatelTrackPoint[] = [];
    for (const [index, list] of lists.entries()) {
        let first = true;
        for (const position of list) {
            if (position.source !== trackSource) continue;
            track.push({
                ...position,
                gapBefore: index > 0 && first && track.length > 0,
            });
            first = false;
        }
    }
    return { trackSource, track };
};

/**
 * Summarises a NovAtel log without downloading it: the first 4 MB are read
 * whole for the message table and receiver details, and a large file is
 * sampled in small windows across its length (the last one at the very end)
 * for the track and the end time.
 */
export async function loadNovatelSummary(
    url: string,
    size: number,
): Promise<NovatelSummary | undefined> {
    const head = await fetchByteRange(url, 0, NOVATEL_HEAD_BYTES);
    if (!head) return undefined;
    const truncated = head.length < size;

    const { frames } = scanNovatelFrames(head);
    const stats = new Map<
        string,
        NovatelMessageStats & {
            first?: number | undefined;
            last?: number | undefined;
        }
    >();
    let receiver: NovatelReceiver | undefined;
    let startTime: number | undefined;
    let endTime: number | undefined;
    const headPositions: (NovatelPosition & { source: string })[] = [];

    for (const frame of frames) {
        const key = keyOf(frame.framing, frame.name);
        let entry = stats.get(key);
        if (!entry) {
            entry = {
                name: frame.name,
                id: frame.id,
                framing: frame.framing,
                count: 0,
            };
            stats.set(key, entry);
        }
        entry.count++;

        const time = frameTime(frame);
        if (time !== undefined) {
            entry.first ??= time;
            entry.last = time;
            startTime = Math.min(startTime ?? time, time);
            endTime = Math.max(endTime ?? time, time);
        }
        receiver ??= decodeNovatelVersion(head, frame);
        const position = decodeNovatelPosition(head, frame);
        if (position) headPositions.push(position);
    }

    const windows = truncated
        ? await sampleWindows(url, head.length, size)
        : [];
    for (const window of windows) {
        if (window.lastTime !== undefined)
            endTime = Math.max(endTime ?? window.lastTime, window.lastTime);
    }

    const messages = [...stats.values()]
        .map(({ first, last, ...entry }) => {
            const span =
                first !== undefined && last !== undefined
                    ? (last - first) / 1000
                    : 0;
            return {
                ...entry,
                rate:
                    entry.count > 1 && span > 0
                        ? (entry.count - 1) / span
                        : undefined,
            };
        })
        .toSorted((a, b) => b.count - a.count);

    const { trackSource, track } = buildTrack([
        headPositions,
        ...windows.map((window) => window.positions),
    ]);

    return {
        receiver,
        startTime,
        endTime,
        messages,
        messageCount: frames.length,
        scannedBytes: head.length,
        truncated,
        trackSource,
        track: thin(track, MAX_TRACK_POINTS),
        latest: track.at(-1),
    };
}
