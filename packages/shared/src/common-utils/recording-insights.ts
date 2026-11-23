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
    /** Chunks holding at least one message of the topic. */
    chunkCount: number;
    /**
     * Start of the first chunk that holds the topic, in nanoseconds since the
     * epoch. Accurate to one chunk, like everything else here.
     */
    firstSeen: bigint;
    /** End of the last chunk that holds the topic, in nanoseconds. */
    lastSeen: bigint;
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
export const MIN_NOTABLE_SECONDS = 2;
/** Too few chunks to tell an unusual one from a usual one. */
const MIN_CHUNKS_FOR_PAUSES = 8;
/** Message periods a topic may stay silent before that counts as a gap. */
export const SILENT_PERIODS = 3;
/**
 * Chunks a topic has to appear in to count as a stream rather than a one-shot
 * topic. Only a stream has gaps and a frequency.
 *
 * `/tf_static` and its like publish a handful of messages when the recording
 * starts and then nothing, by design. That is a one-shot topic, not a stream
 * that dropped out, and the chunk index tells the two apart: a stream shows up
 * in chunk after chunk, a one-shot topic in one or two.
 */
export const MIN_CHUNKS_FOR_STREAM = 5;

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
export function uncoveredSpans(
    covered: TimeSpan[],
    duration: number,
): TimeSpan[] {
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

interface LocatedChunk {
    span: TimeSpan;
    startTime: bigint;
    endTime: bigint;
    channelIds: number[];
}

/** The chunks each topic appears in, in recording order. */
function chunksPerTopic(
    chunks: LocatedChunk[],
    channels: RecordingChannel[],
): Map<string, LocatedChunk[]> {
    const topicOf = new Map(
        channels.map((channel) => [channel.id, channel.topic]),
    );
    const chunksByTopic = new Map<string, LocatedChunk[]>();
    for (const chunk of chunks) {
        const topics = new Set<string>();
        for (const channelId of chunk.channelIds) {
            const topic = topicOf.get(channelId);
            if (topic !== undefined) topics.add(topic);
        }
        for (const topic of topics) {
            const topicChunks = chunksByTopic.get(topic) ?? [];
            topicChunks.push(chunk);
            chunksByTopic.set(topic, topicChunks);
        }
    }
    return chunksByTopic;
}

/** Start of the earliest and end of the latest of `chunks`. */
function seenBounds(
    chunks: LocatedChunk[],
    fallback: bigint,
): { firstSeen: bigint; lastSeen: bigint } {
    let firstSeen = chunks[0]?.startTime ?? fallback;
    let lastSeen = chunks[0]?.endTime ?? fallback;
    for (const chunk of chunks) {
        if (chunk.startTime < firstSeen) firstSeen = chunk.startTime;
        if (chunk.endTime > lastSeen) lastSeen = chunk.endTime;
    }
    return { firstSeen, lastSeen };
}

/**
 * Per topic, where the recording has data and where it conspicuously has none.
 *
 * Returns undefined when there is nothing to draw: no chunks, or a recording
 * without any duration. `topics` is empty when any chunk lacks a message
 * index, since coverage would then be partly unknown.
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

    const located: LocatedChunk[] = chunks
        .map((chunk) => ({
            span: {
                start: seconds(chunk.startTime, origin),
                end: seconds(chunk.endTime, origin),
            },
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            channelIds: chunk.channelIds,
        }))
        // A fresh array from `map`, so sorting in place reaches no caller.
        // eslint-disable-next-line unicorn/no-array-sort
        .sort((a, b) => a.span.start - b.span.start);
    const chunkSpans = located.map((chunk) => chunk.span);
    const typicalChunk = median(
        chunkSpans.map((span) => span.end - span.start),
    );

    // A chunk without a message index does not say which channels it holds,
    // so a topic missing from it is unknown rather than absent. Drawn anyway,
    // every unindexed stretch would look like a dropout of every topic.
    const topics: Record<string, TopicCoverage> = {};
    if (!chunks.every((chunk) => chunk.hasMessageIndex)) {
        return {
            startTime: origin,
            durationSeconds,
            topics,
            pauses: findPauses(chunkSpans),
        };
    }

    const counts = countMessages(channels);
    for (const [topic, topicChunks] of chunksPerTopic(located, channels)) {
        const spans = topicChunks.map((chunk) => chunk.span);
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
        const isStream = spans.length >= MIN_CHUNKS_FOR_STREAM;
        topics[topic] = {
            covered,
            gaps: isStream
                ? uncoveredSpans(covered, durationSeconds).filter(
                      (hole) => hole.end - hole.start > tolerance,
                  )
                : [],
            chunkCount: topicChunks.length,
            ...seenBounds(topicChunks, origin),
        };
    }

    return {
        startTime: origin,
        durationSeconds,
        topics,
        pauses: findPauses(chunkSpans),
    };
}

/**
 * Messages per second over the stretch the topic publishes in, from its first
 * chunk to its last.
 *
 * Dividing by the whole recording instead understates every topic that starts
 * late or stops early. Undefined, meaning the topic has no rate:
 *
 * - for a one-shot topic: seen in fewer than {@link MIN_CHUNKS_FOR_STREAM}
 *   chunks of a file that has at least that many. Writers cut chunks by size,
 *   so in a file with fewer chunks the index cannot tell a stream from a
 *   one-shot topic, and only a single message counts as having no rate;
 * - for a topic whose span is zero;
 * - when the recorder wrote no message counts.
 */
export function topicFrequency(
    messageCount: number | undefined,
    coverage: Pick<TopicCoverage, 'chunkCount' | 'firstSeen' | 'lastSeen'>,
    fileChunkCount: number,
): number | undefined {
    if (messageCount === undefined || messageCount < 2) return undefined;
    const canTellOneShots = fileChunkCount >= MIN_CHUNKS_FOR_STREAM;
    if (canTellOneShots && coverage.chunkCount < MIN_CHUNKS_FOR_STREAM) {
        return undefined;
    }
    const span = seconds(coverage.lastSeen, coverage.firstSeen);
    return span > 0 ? messageCount / span : undefined;
}

/** `[start, end]` in whole milliseconds since the recording's first message. */
export type CoverageSpanMs = [startMs: number, endMs: number];

/**
 * The coverage of one topic in the form the backend stores it on the topic.
 *
 * Milliseconds rather than nanoseconds: the spans end up as JSON numbers,
 * which lose precision above 2^53, and the coverage is only accurate to one
 * chunk anyway.
 */
export interface StoredTopicStats {
    firstSeen: Date;
    lastSeen: Date;
    chunkCount: number;
    /** `covered`, relative to {@link RecordingCoverage.startTime}. */
    coverage: CoverageSpanMs[];
    /** See {@link topicFrequency}. */
    frequency: number | undefined;
}

const toMilliseconds = (secondsValue: number): number =>
    Math.round(secondsValue * 1000);

const toDate = (timeNs: bigint): Date => new Date(Number(timeNs / 1_000_000n));

/**
 * Coverage of an indexed recording without duration: a single message, or
 * messages that all share one timestamp. {@link computeRecordingCoverage}
 * has nothing to draw there, but the index still says which topics the file
 * holds and in how many chunks. Every such topic covers the one instant, and
 * has no rate since its span is zero.
 *
 * Undefined without chunks, with duration, or when a chunk lacks a message
 * index, exactly when the regular computation decides instead.
 */
function instantCoverage(
    chunks: RecordingChunk[],
    channels: RecordingChannel[],
): RecordingCoverage | undefined {
    const instant = chunks.at(0)?.startTime;
    if (instant === undefined) return undefined;
    const isInstant = chunks.every(
        (chunk) =>
            chunk.hasMessageIndex &&
            chunk.startTime === instant &&
            chunk.endTime === instant,
    );
    if (!isInstant) return undefined;

    const located: LocatedChunk[] = chunks.map((chunk) => ({
        span: { start: 0, end: 0 },
        startTime: instant,
        endTime: instant,
        channelIds: chunk.channelIds,
    }));
    const topics: Record<string, TopicCoverage> = {};
    for (const [topic, topicChunks] of chunksPerTopic(located, channels)) {
        topics[topic] = {
            covered: [{ start: 0, end: 0 }],
            gaps: [],
            chunkCount: topicChunks.length,
            firstSeen: instant,
            lastSeen: instant,
        };
    }
    return { startTime: instant, durationSeconds: 0, topics, pauses: [] };
}

/**
 * Per topic, what the backend stores about where it has data.
 *
 * Built on {@link computeRecordingCoverage}, so stored and live values agree.
 * A recording without duration (a single message) still gets its topics,
 * covering one instant and without a rate. Empty when coverage is unknown: no
 * chunks, or a chunk without a message index.
 */
export function computeTopicStats(
    chunks: RecordingChunk[],
    channels: RecordingChannel[],
): Map<string, StoredTopicStats> {
    const stats = new Map<string, StoredTopicStats>();
    const coverage =
        computeRecordingCoverage(chunks, channels) ??
        instantCoverage(chunks, channels);
    if (!coverage) return stats;

    const counts = countMessages(channels);
    for (const [topic, topicCoverage] of Object.entries(coverage.topics)) {
        stats.set(topic, {
            firstSeen: toDate(topicCoverage.firstSeen),
            lastSeen: toDate(topicCoverage.lastSeen),
            chunkCount: topicCoverage.chunkCount,
            coverage: topicCoverage.covered.map((span): CoverageSpanMs => [
                toMilliseconds(span.start),
                toMilliseconds(span.end),
            ]),
            frequency: topicFrequency(
                counts.get(topic),
                topicCoverage,
                chunks.length,
            ),
        });
    }
    return stats;
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
