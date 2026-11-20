/**
 * The per-topic statistics the file page shows next to each topic: when the
 * topic was first and last seen, its mean rate, and where in the recording it
 * has data.
 *
 * They come from one of two places. Files processed (or reindexed) since
 * topic statistics were introduced carry them in the database
 * (`topicStatsVersion` ≥ 1). For older MCAPs the page reads them live from
 * the file's summary, with the same chunk-based rules, so the two agree.
 */
import {
    mergeSpans,
    MIN_CHUNKS_FOR_GAPS,
    MIN_NOTABLE_SECONDS,
    RecordingChannel,
    RecordingChunk,
    RecordingCoverage,
    SILENT_PERIODS,
    TimeSpan,
    uncoveredSpans,
} from './recording-insights';

export interface TopicStats {
    /** Seconds since the recording start, at the resolution of one chunk. */
    firstSeen: number;
    lastSeen: number;
    /** Chunks the topic appears in; undefined when unknown. */
    chunkCount: number | undefined;
    /**
     * Messages divided by the topic's own span, `lastSeen − firstSeen`.
     * Undefined for topics seen in fewer than {@link MIN_CHUNKS_FOR_GAPS}
     * chunks: a latched or one-shot topic has no meaningful rate.
     */
    meanHz: number | undefined;
    /** Where the topic has data; empty when unknown. */
    covered: TimeSpan[];
    /** Stretches without data that are too long to be the topic's own rate. */
    gaps: TimeSpan[];
}

export interface FileTopicStats {
    source: 'stored' | 'live';
    /** Origin of every span, in nanoseconds since the epoch. */
    startTime: bigint;
    durationSeconds: number;
    /** Stretches in which the recorder wrote little or nothing at all. */
    pauses: TimeSpan[];
    topics: Record<string, TopicStats>;
}

/** Count ÷ span, for topics seen in enough chunks to have a rate at all. */
export function meanRate(
    count: number | undefined,
    chunkCount: number | undefined,
    firstSeen: number,
    lastSeen: number,
): number | undefined {
    if (count === undefined || chunkCount === undefined) return undefined;
    if (chunkCount < MIN_CHUNKS_FOR_GAPS) return undefined;
    const span = lastSeen - firstSeen;
    return span > 0 && count > 0 ? count / span : undefined;
}

/**
 * Topic statistics from the summary the file page reads anyway.
 *
 * `coverage` is what `computeRecordingCoverage` made of the same
 * chunks; its spans and gaps are kept as they are. Returns undefined when
 * coverage is unknown.
 */
export function liveTopicStats(
    coverage: RecordingCoverage | undefined,
    chunks: RecordingChunk[],
    channels: RecordingChannel[],
): FileTopicStats | undefined {
    if (!coverage) return undefined;
    const origin = coverage.startTime;
    const seconds = (time: bigint): number => Number(time - origin) / 1e9;

    const topicOf = new Map(
        channels.map((channel) => [channel.id, channel.topic]),
    );
    const counts = new Map<string, number | undefined>();
    for (const channel of channels) {
        const known = counts.get(channel.topic);
        counts.set(
            channel.topic,
            channel.messageCount === undefined
                ? known
                : (known ?? 0) + channel.messageCount,
        );
    }

    const seen = new Map<string, { first: number; last: number; n: number }>();
    for (const chunk of chunks) {
        const topics = new Set<string>();
        for (const id of chunk.channelIds) {
            const topic = topicOf.get(id);
            if (topic !== undefined) topics.add(topic);
        }
        const start = seconds(chunk.startTime);
        const end = seconds(chunk.endTime);
        for (const topic of topics) {
            const entry = seen.get(topic);
            if (entry) {
                entry.first = Math.min(entry.first, start);
                entry.last = Math.max(entry.last, end);
                entry.n++;
            } else {
                seen.set(topic, { first: start, last: end, n: 1 });
            }
        }
    }

    const topics: Record<string, TopicStats> = {};
    // Topics are only listed when every chunk has a message index.
    for (const [topic, topicCoverage] of Object.entries(coverage.topics)) {
        const entry = seen.get(topic);
        if (!entry) continue;
        topics[topic] = {
            firstSeen: entry.first,
            lastSeen: entry.last,
            chunkCount: entry.n,
            meanHz: meanRate(
                counts.get(topic),
                entry.n,
                entry.first,
                entry.last,
            ),
            covered: topicCoverage.covered,
            gaps: topicCoverage.gaps,
        };
    }

    return {
        source: 'live',
        startTime: origin,
        durationSeconds: coverage.durationSeconds,
        pauses: coverage.pauses,
        topics,
    };
}

/** The topic fields the API stores once a file has topic statistics. */
export interface StoredTopic {
    name: string;
    frequency?: number | null;
    firstSeen?: Date | string | null;
    lastSeen?: Date | string | null;
    chunkCount?: number | null;
    /** `[startMs, endMs]` offsets from the file's recording start. */
    coverage?: [number, number][] | null;
}

export interface StoredFile {
    recordingStartDate: Date | string | null;
    durationSeconds: number | null;
    topicStatsVersion?: number | null;
}

const toMs = (value: Date | string | null | undefined): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? undefined : ms;
};

/**
 * Gaps in stored coverage, by the same rules as the live read: only for
 * topics seen in enough chunks, and only silences longer than a few of the
 * topic's own periods. The chunk length is not stored, so the tolerance
 * leaves it out; holes between stored spans are already wider than it.
 */
function storedGaps(
    covered: TimeSpan[],
    durationSeconds: number,
    chunkCount: number | undefined,
    meanHz: number | undefined,
): TimeSpan[] {
    if (chunkCount === undefined || chunkCount < MIN_CHUNKS_FOR_GAPS) return [];
    if (covered.length === 0) return [];
    const period = meanHz === undefined ? 0 : 1 / meanHz;
    const tolerance = Math.max(SILENT_PERIODS * period, MIN_NOTABLE_SECONDS);
    return uncoveredSpans(
        mergeSpans(covered, tolerance),
        durationSeconds,
    ).filter((hole) => hole.end - hole.start > tolerance);
}

/**
 * Topic statistics as the API stores them.
 *
 * Returns undefined until the file has been indexed for them
 * (`topicStatsVersion` < 1) or while its recording start is unknown, which
 * every span is relative to. A topic whose statistics could not be read
 * (a chunk without a message index, say) is left out.
 */
export function storedTopicStats(
    file: StoredFile,
    topics: StoredTopic[],
    pauses: TimeSpan[] = [],
): FileTopicStats | undefined {
    if ((file.topicStatsVersion ?? 0) < 1) return undefined;
    const startMs = toMs(file.recordingStartDate);
    if (startMs === undefined) return undefined;

    const result: Record<string, TopicStats> = {};
    let durationSeconds = file.durationSeconds ?? 0;
    for (const topic of topics) {
        const first = toMs(topic.firstSeen);
        const last = toMs(topic.lastSeen);
        if (first === undefined || last === undefined) continue;
        const firstSeen = (first - startMs) / 1000;
        const lastSeen = (last - startMs) / 1000;
        durationSeconds = Math.max(durationSeconds, lastSeen);

        const chunkCount = topic.chunkCount ?? undefined;
        const frequency = topic.frequency ?? 0;
        const meanHz =
            chunkCount !== undefined &&
            chunkCount >= MIN_CHUNKS_FOR_GAPS &&
            frequency > 0
                ? frequency
                : undefined;
        const covered = (topic.coverage ?? [])
            .map(([start, end]) => ({ start: start / 1000, end: end / 1000 }))
            // A fresh array from `map`, so sorting in place reaches no caller.
            // eslint-disable-next-line unicorn/no-array-sort
            .sort((a, b) => a.start - b.start);
        result[topic.name] = {
            firstSeen,
            lastSeen,
            chunkCount,
            meanHz,
            covered,
            gaps: [],
        };
    }
    if (durationSeconds <= 0) return undefined;
    for (const stats of Object.values(result)) {
        stats.gaps = storedGaps(
            stats.covered,
            durationSeconds,
            stats.chunkCount,
            stats.meanHz,
        );
    }

    return {
        source: 'stored',
        startTime: BigInt(startMs) * 1_000_000n,
        durationSeconds,
        pauses,
        topics: result,
    };
}

/** Spans measured from `from`, measured from `to` instead (both in ns). */
export function rebaseSpans(
    spans: TimeSpan[],
    from: bigint,
    to: bigint,
): TimeSpan[] {
    const shift = Number(from - to) / 1e9;
    return spans.map((span) => ({
        start: span.start + shift,
        end: span.end + shift,
    }));
}
