/**
 * What a recording's own index says about it, beyond its messages.
 *
 * An MCAP summary lists every chunk with its time range and the channels it
 * holds. That is enough to draw, per topic, where in the recording the topic
 * has data, without reading a single message. The file preview loads the
 * summary anyway, so everything here costs no extra request.
 *
 * The resolution is one chunk. A topic absent from a chunk had no message in
 * that chunk's time range; where inside a chunk the messages sit is unknown.
 */

/** The fields of an MCAP chunk index that coverage is computed from. */
export interface RecordingChunk {
    startTime: bigint;
    endTime: bigint;
    compression: string;
    compressedSize: bigint;
    uncompressedSize: bigint;
    /** Channels with at least one message in the chunk. */
    channelIds: number[];
    /** False when the chunk was written without a message index. */
    hasMessageIndex: boolean;
}

export interface RecordingChannel {
    id: number;
    topic: string;
    messageCount: number | undefined;
}

/** A stretch of the recording, in seconds since its first message. */
export interface TimeSpan {
    start: number;
    end: number;
}

export interface TopicCoverage {
    /** Where the topic has data. */
    covered: TimeSpan[];
    /** Stretches without data that are too long to be the topic's own rate. */
    gaps: TimeSpan[];
}

export interface RecordingCoverage {
    /** Log time of the first message, the origin of every `TimeSpan`. */
    startTime: bigint;
    durationSeconds: number;
    topics: Record<string, TopicCoverage>;
    /** Stretches in which the recorder wrote little or nothing at all. */
    pauses: TimeSpan[];
}

export interface RecordingStorage {
    chunkCount: number;
    /** Compression names in use; an uncompressed chunk counts as `none`. */
    compressions: string[];
    compressedSize: number;
    uncompressedSize: number;
    /**
     * Whether single messages can be fetched: every chunk is uncompressed and
     * indexed. Otherwise a topic filter on a partial download still pulls
     * whole chunks, and only a time window cuts the transfer.
     */
    perMessageAccess: boolean;
}

/** A chunk this many times longer than the median counts as a pause. */
const PAUSE_FACTOR = 4;
/** Shorter stretches are never reported, whatever the chunks look like. */
const MIN_NOTABLE_SECONDS = 2;
/** Too few chunks to tell an unusual one from a usual one. */
const MIN_CHUNKS_FOR_PAUSES = 8;
/** Message periods a topic may stay silent before that counts as a gap. */
const SILENT_PERIODS = 3;
/**
 * Chunks a topic has to appear in before its silences are reported.
 *
 * `/tf_static` and its like publish a handful of messages when the recording
 * starts and then nothing, by design. That is a one-shot topic, not a stream
 * that dropped out, and the chunk index tells the two apart: a stream shows up
 * in chunk after chunk, a one-shot topic in one or two.
 */
const MIN_CHUNKS_FOR_GAPS = 5;

const seconds = (time: bigint, origin: bigint): number =>
    Number(time - origin) / 1e9;

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    // `toSorted` is ES2023 and this package targets ES2022.
    // eslint-disable-next-line unicorn/no-array-sort
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/**
 * Chunks that span far more time than the others.
 *
 * Recorders cut chunks by size, so a pause in recording does not end a chunk:
 * the chunk simply covers the pause. It shows up as one chunk much longer than
 * the median, and that is all the summary can say about it. The pause lies
 * somewhere inside the reported span.
 */
export function findPauses(spans: TimeSpan[]): TimeSpan[] {
    if (spans.length < MIN_CHUNKS_FOR_PAUSES) return [];
    const typical = median(spans.map((span) => span.end - span.start));
    const threshold = Math.max(PAUSE_FACTOR * typical, MIN_NOTABLE_SECONDS);
    return spans.filter((span) => span.end - span.start > threshold);
}

/**
 * Join spans that lie closer together than `tolerance`.
 *
 * `spans` must be sorted by start. Chunks overlap or leave small holes
 * between them all the time; neither is a gap in the data.
 */
export function mergeSpans(spans: TimeSpan[], tolerance: number): TimeSpan[] {
    const merged: TimeSpan[] = [];
    for (const span of spans) {
        const last = merged.at(-1);
        if (last && span.start - last.end <= tolerance) {
            last.end = Math.max(last.end, span.end);
        } else {
            merged.push({ ...span });
        }
    }
    return merged;
}

/** The stretches of `[0, duration]` that `covered` leaves out. */
function uncovered(covered: TimeSpan[], duration: number): TimeSpan[] {
    const holes: TimeSpan[] = [];
    let cursor = 0;
    for (const span of covered) {
        if (span.start > cursor) holes.push({ start: cursor, end: span.start });
        cursor = Math.max(cursor, span.end);
    }
    if (duration > cursor) holes.push({ start: cursor, end: duration });
    return holes;
}

/** Message count per topic; undefined when the recorder wrote no statistics. */
function countMessages(
    channels: RecordingChannel[],
): Map<string, number | undefined> {
    const counts = new Map<string, number | undefined>();
    for (const channel of channels) {
        // Several publishers of one topic record on a channel each.
        const known = counts.get(channel.topic);
        counts.set(
            channel.topic,
            channel.messageCount === undefined
                ? known
                : (known ?? 0) + channel.messageCount,
        );
    }
    return counts;
}

/** The spans of the chunks each topic appears in, in recording order. */
function spansPerTopic(
    chunks: { span: TimeSpan; channelIds: number[] }[],
    channels: RecordingChannel[],
): Map<string, TimeSpan[]> {
    const topicOf = new Map(
        channels.map((channel) => [channel.id, channel.topic]),
    );
    const spansByTopic = new Map<string, TimeSpan[]>();
    for (const chunk of chunks) {
        const topics = new Set<string>();
        for (const channelId of chunk.channelIds) {
            const topic = topicOf.get(channelId);
            if (topic !== undefined) topics.add(topic);
        }
        for (const topic of topics) {
            const spans = spansByTopic.get(topic) ?? [];
            spans.push(chunk.span);
            spansByTopic.set(topic, spans);
        }
    }
    return spansByTopic;
}

/**
 * Per topic, where the recording has data and where it conspicuously has none.
 *
 * Returns undefined when there is nothing to draw: no chunks, or a recording
 * without any duration.
 */
export function computeRecordingCoverage(
    chunks: RecordingChunk[],
    channels: RecordingChannel[],
): RecordingCoverage | undefined {
    let startTime: bigint | undefined;
    let endTime: bigint | undefined;
    for (const chunk of chunks) {
        if (startTime === undefined || chunk.startTime < startTime) {
            startTime = chunk.startTime;
        }
        if (endTime === undefined || chunk.endTime > endTime) {
            endTime = chunk.endTime;
        }
    }
    if (startTime === undefined || endTime === undefined) return undefined;

    const origin = startTime;
    const durationSeconds = seconds(endTime, origin);
    if (durationSeconds <= 0) return undefined;

    const located = chunks
        .map((chunk) => ({
            span: {
                start: seconds(chunk.startTime, origin),
                end: seconds(chunk.endTime, origin),
            },
            channelIds: chunk.channelIds,
        }))
        // A fresh array from `map`, so sorting in place reaches no caller.
        // eslint-disable-next-line unicorn/no-array-sort
        .sort((a, b) => a.span.start - b.span.start);
    const chunkSpans = located.map((chunk) => chunk.span);
    const typicalChunk = median(
        chunkSpans.map((span) => span.end - span.start),
    );

    const counts = countMessages(channels);
    const topics: Record<string, TopicCoverage> = {};
    for (const [topic, spans] of spansPerTopic(located, channels)) {
        const count = counts.get(topic);
        // A slow topic is absent from most chunks without anything being
        // wrong, so the silence it is allowed scales with its own period.
        const period =
            count !== undefined && count > 1 ? durationSeconds / count : 0;
        const tolerance = Math.max(
            2 * typicalChunk,
            SILENT_PERIODS * period,
            MIN_NOTABLE_SECONDS,
        );
        const covered = mergeSpans(spans, tolerance);
        const isStream = spans.length >= MIN_CHUNKS_FOR_GAPS;
        topics[topic] = {
            covered,
            gaps: isStream
                ? uncovered(covered, durationSeconds).filter(
                      (hole) => hole.end - hole.start > tolerance,
                  )
                : [],
        };
    }

    return {
        startTime: origin,
        durationSeconds,
        topics,
        pauses: findPauses(chunkSpans),
    };
}

/** How the chunks are stored, and what that means for a partial download. */
export function summarizeStorage(chunks: RecordingChunk[]): RecordingStorage {
    const compressions = new Set<string>();
    let compressedSize = 0;
    let uncompressedSize = 0;
    for (const chunk of chunks) {
        compressions.add(chunk.compression === '' ? 'none' : chunk.compression);
        compressedSize += Number(chunk.compressedSize);
        uncompressedSize += Number(chunk.uncompressedSize);
    }
    return {
        chunkCount: chunks.length,
        // eslint-disable-next-line unicorn/no-array-sort
        compressions: [...compressions].sort(),
        compressedSize,
        uncompressedSize,
        perMessageAccess:
            chunks.length > 0 &&
            chunks.every(
                (chunk) => chunk.compression === '' && chunk.hasMessageIndex,
            ),
    };
}
