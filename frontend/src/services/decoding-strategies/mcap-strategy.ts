import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import {
    CHUNK_HEADER_FIXED_LEN,
    chunkDataStart,
    coalesce,
    computeRecordingCoverage,
    liveFileTopicStats,
    parseMessageIndexes,
    parseMessageRecord,
    planChunk,
    RecordingChunk,
    summarizeStorage,
    UniversalHttpReader,
} from '@kleinkram/shared';
import { McapByteReader, McapIndexedReader, parseRecord } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { mapInOrder } from './fetch-pool';
import { DecodingStrategy } from './index';
import type {
    RecordingInsights,
    RecordingMetadata,
    RecordingSchema,
} from './recording-insights';
import {
    coarseToFineOrder,
    LogMessage,
    MainThreadBudget,
    ReadOptions,
} from './utilities';

/** Identity of a message record, used to drop duplicates from overlapping chunks */
const messageIdentity = (message: {
    channelId: number;
    logTime: bigint;
    publishTime: bigint;
    sequence: number;
}): string =>
    `${String(message.channelId)}:${String(message.logTime)}:${String(message.publishTime)}:${String(message.sequence)}`;

/** The subset of `@mcap/core`'s ChunkIndex this strategy relies on. */
interface McapChunkIndex {
    chunkStartOffset: bigint;
    chunkLength: bigint;
    uncompressedSize: bigint;
    compression: string;
    messageIndexOffsets: Map<number, bigint>;
    messageIndexLength: bigint;
    messageStartTime: bigint;
    messageEndTime: bigint;
}

/**
 * Merge message ranges closer together than this into one request.
 *
 * Smaller fetches less and costs more round trips. Measured against object
 * storage, total time is flat between roughly 256 kB and 1 MB, so the default
 * sits at the lean end of that basin.
 */
const PREVIEW_COALESCE_GAP = 256 * 1024;

/**
 * Coalesce gap once a stride has been applied.
 *
 * Merging across a gap re-fetches whatever lies inside it -- which, after
 * sampling, is exactly the records the stride just skipped. The full gap is
 * therefore wrong here: on a 2.15 GB recording sampled at every 18th message
 * it pulled 107 MB where a smaller gap pulls 28 MB for the same result and
 * the same wall-clock. Not zero, because one request per record is worse
 * still: that costs 5600 requests against 2500.
 */
const SAMPLED_COALESCE_GAP = 16 * 1024;

/**
 * Range reads in flight at once, across every chunk being read.
 *
 * These reads are latency-bound: a sampled preview of a dense topic plans
 * around 800 chunk indexes and fetches roughly a thousand small ranges, so
 * issuing them one at a time makes round trips the whole cost. Browsers cap
 * connections per host around six, so going much beyond this buys nothing.
 */
const FETCH_CONCURRENCY = 12;

/**
 * Chunks read at once in the progressive path.
 *
 * Each chunk costs an index read plus a few small range reads, and a sampled
 * preview visits hundreds of them, so reading one chunk at a time leaves the
 * connection idle between round trips. Kept below FETCH_CONCURRENCY because
 * each chunk fans out into range reads of its own.
 */
const CHUNK_CONCURRENCY = 6;

/**
 * A single chunk's share of FETCH_CONCURRENCY.
 *
 * Chunks are read through a pool of their own, so a per-chunk cap equal to the
 * global one would multiply: six chunks fetching twelve ranges each is
 * seventy-two requests in flight, not twelve. Over HTTP/2 those all reach
 * storage at once, which is how a preview turns into the 500s it then has to
 * retry. Dividing keeps the product at the budget, and costs nothing in
 * practice because the outer pool keeps the full twelve busy anyway.
 */
const RANGE_CONCURRENCY = Math.max(
    1,
    Math.floor(FETCH_CONCURRENCY / CHUNK_CONCURRENCY),
);

/** What `parseMessageRecord` yields, shaped like `@mcap/core`'s message. */
interface ParsedChunkMessage {
    channelId: number;
    sequence: number;
    logTime: bigint;
    publishTime: bigint;
    data: Uint8Array;
    /** Position among the wanted channels' messages in this chunk. */
    position?: number | undefined;
}

/** Length of a Message Index record before its entries. */
const MESSAGE_INDEX_HEADER_LEN = 15;
/** Length of one Message Index entry (log time and offset). */
const MESSAGE_INDEX_ENTRY_LEN = 16;

/** Chunk decompressors, keyed by the MCAP compression name. */
const DECOMPRESS: Record<string, (data: Uint8Array) => Uint8Array> = {
    zstd: (buffer) => fzstd.decompress(buffer),
    lz4: (buffer) => lz4js.decompress(buffer),
};

export class McapStrategy extends DecodingStrategy {
    private reader: McapIndexedReader | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private decoders = new Map<number, any>();
    private httpReader: UniversalHttpReader | null = null;

    override readonly supportsWindow = true;

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.httpReader = httpReader;
        this.reader = await McapIndexedReader.Initialize({
            readable: httpReader,
            decompressHandlers: {
                ...DECOMPRESS,
                bz2: () => {
                    throw new Error('BZ2 not supported');
                },
            },
        });
    }

    /**
     * Read from the summary `init` has already loaded, so this costs nothing
     * further: no request, and no message is touched.
     */
    override getInsights(): RecordingInsights | null {
        const reader = this.reader;
        if (!reader) return null;

        const chunks: RecordingChunk[] = reader.chunkIndexes.map((chunk) => ({
            startTime: chunk.messageStartTime,
            endTime: chunk.messageEndTime,
            compression: chunk.compression,
            compressedSize: chunk.compressedSize,
            uncompressedSize: chunk.uncompressedSize,
            channelIds: [...chunk.messageIndexOffsets.keys()],
            hasMessageIndex: chunk.messageIndexOffsets.size > 0,
        }));

        const counts = reader.statistics?.channelMessageCounts;
        const channels = [...reader.channelsById.values()].map((channel) => {
            const count = counts?.get(channel.id);
            return {
                id: channel.id,
                topic: channel.topic,
                messageCount: count === undefined ? undefined : Number(count),
            };
        });

        const schemasByTopic: Record<string, RecordingSchema> = {};
        for (const channel of reader.channelsById.values()) {
            const schema = reader.schemasById.get(channel.schemaId);
            if (!schema) continue;
            let definition: string | undefined;
            try {
                definition = new TextDecoder('utf-8', { fatal: true }).decode(
                    schema.data,
                );
            } catch {
                // Binary schema: there is no text to show.
            }
            schemasByTopic[channel.topic] = {
                name: schema.name,
                encoding: schema.encoding,
                definition,
            };
        }

        const coverage = computeRecordingCoverage(chunks, channels);

        return {
            profile: reader.header.profile,
            library: reader.header.library,
            storage: summarizeStorage(chunks),
            coverage,
            topicStats: liveFileTopicStats(coverage, chunks, channels),
            schemasByTopic,
            attachments: reader.attachmentIndexes.map((attachment) => ({
                name: attachment.name,
                mediaType: attachment.mediaType,
                size: Number(attachment.dataSize),
                logTime: attachment.logTime,
            })),
            metadataNames: reader.metadataIndexes.map((index) => index.name),
        };
    }

    override async readAttachment(
        index: number,
    ): Promise<Uint8Array | undefined> {
        const wanted = this.reader?.attachmentIndexes[index];
        if (!this.httpReader || !wanted) return undefined;

        // Read the record the index entry points at. Neither the name nor the
        // log time has to be unique, so looking the attachment up by them can
        // return a different one.
        const bytes = await this.httpReader.read(wanted.offset, wanted.length);
        const record = parseRecord(
            new McapByteReader(
                new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
            ),
            true,
        );
        if (record?.type !== 'Attachment') {
            throw new Error(
                `No attachment record at offset ${wanted.offset.toString()}`,
            );
        }
        return record.data;
    }

    override async readMetadata(): Promise<RecordingMetadata[]> {
        if (!this.reader) return [];
        const records: RecordingMetadata[] = [];
        for await (const record of this.reader.readMetadata()) {
            records.push({
                name: record.name,
                values: Object.fromEntries(record.metadata),
            });
        }
        return records;
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
        options: ReadOptions = {},
    ): Promise<LogMessage[]> {
        if (!this.reader || !this.httpReader) return [];
        const keepEvery = Math.max(1, Math.floor(options.stride ?? 1));

        if (
            options.window ||
            (options.progressive && startTime === undefined)
        ) {
            return this.getMessagesProgressive(
                topic,
                keepEvery,
                limit,
                onMessage,
                signal,
                options.skip,
                options.totalMessages,
                options.window,
            );
        }

        const msgs: LogMessage[] = [];
        const budget = new MainThreadBudget();
        let seen = 0;

        // Chunks hold every topic interleaved, so reading one low-rate topic
        // chunk-by-chunk transfers almost the whole recording. When the chunks
        // are uncompressed their message indexes address individual records,
        // which is dramatically less to fetch for exactly the same result.
        const indexed = await this.getMessagesByMessageIndex(
            topic,
            keepEvery,
            limit,
            onMessage,
            signal,
            startTime,
        );
        if (indexed) return indexed;

        const readArguments: { topics: string[]; startTime?: bigint } = {
            topics: [topic],
        };
        if (startTime !== undefined) readArguments.startTime = startTime;

        // Prefetch chunks
        // We need to access private chunkIndexes, but McapIndexedReader exposes them publicly in recent versions
        // or we can cast to any if needed. The source code showed `chunkIndexes` as a property.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const chunkIndexes = (this.reader as any).chunkIndexes as any[];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (chunkIndexes) {
            const relevantChunks = chunkIndexes.filter(
                (c) =>
                    // Check if chunk overlaps with our interest
                    // If startTime is set, chunk must end after it
                    (startTime === undefined ||
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        c.messageEndTime >= startTime) &&
                    // We don't have an endTime limit usually, but if we did:
                    // (endTime === undefined || c.messageStartTime <= endTime)
                    true,
            );

            // Prefetch the first few chunks (e.g. up to limit, but chunks contain many messages)
            // Since we don't know how many messages are in a chunk, prefetching the first 2-3 is a safe bet
            // to get parallelism without over-fetching too much.
            const chunksToPrefetch = relevantChunks.slice(0, 5);

            for (const chunk of chunksToPrefetch) {
                this.httpReader.prefetch(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    chunk.chunkStartOffset,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    chunk.chunkLength,
                );
            }
        }

        for await (const message of this.reader.readMessages(readArguments)) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;
            // Skip (without decoding) messages that fall between samples
            if (seen++ % keepEvery !== 0) continue;
            let data = message.data;
            const channel = this.reader.channelsById.get(message.channelId);
            if (channel) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data =
                    (await this.tryDecode(channel.schemaId, message.data)) ??
                    message.data;
            }
            const messageObject = { logTime: message.logTime, data };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
            await budget.yieldIfNeeded();
        }
        return msgs;
    }

    /**
     * Reads the chunks containing `topic` coarse-to-fine so that the whole
     * recording is covered early. Within each chunk only every
     * `keepEvery`-th message is decoded.
     */
    /**
     * Read one topic by addressing its messages directly, or undefined when
     * that is not possible for this recording.
     *
     * Returns undefined -- rather than throwing or returning [] -- when any
     * relevant chunk is compressed or unindexed, so the caller falls back to
     * the ordinary reader and the result is identical either way.
     */
    private async getMessagesByMessageIndex(
        topic: string,
        keepEvery: number,
        limit: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
    ): Promise<LogMessage[] | undefined> {
        // As in the progressive path: a failed read falls back rather than
        // failing the topic.
        try {
            return await this.getMessagesByMessageIndexUnsafe(
                topic,
                keepEvery,
                limit,
                onMessage,
                signal,
                startTime,
            );
        } catch {
            return undefined;
        }
    }

    private async getMessagesByMessageIndexUnsafe(
        topic: string,
        keepEvery: number,
        limit: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
    ): Promise<LogMessage[] | undefined> {
        const reader = this.reader;
        const httpReader = this.httpReader;
        if (!reader || !httpReader) return undefined;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const chunkIndexes = (reader as any).chunkIndexes as
            McapChunkIndex[] | undefined;
        if (!chunkIndexes || chunkIndexes.length === 0) return undefined;

        const channelIds = new Set<number>();
        for (const [id, channel] of reader.channelsById) {
            if (channel.topic === topic) channelIds.add(id);
        }
        if (channelIds.size === 0) return [];

        const candidates: McapChunkIndex[] = [];
        for (const chunk of chunkIndexes) {
            if (chunk.compression !== '') return undefined;
            if (startTime !== undefined && chunk.messageEndTime < startTime) {
                continue;
            }
            const offsets = chunk.messageIndexOffsets;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!offsets || offsets.size === 0) return undefined;

            let wanted = false;
            for (const id of channelIds) {
                if (offsets.has(id)) wanted = true;
            }
            if (wanted) candidates.push(chunk);
        }
        if (candidates.length === 0) return [];

        // Emit per chunk rather than planning the whole topic first.
        //
        // Reading every chunk's index before fetching anything meant a log
        // topic of several thousand messages sat at "0 loaded" for as long as
        // the planning took -- hundreds of round trips -- even though the
        // first chunk's messages were ready almost immediately. Chunks are in
        // file order, so emitting as they arrive is also the right order.
        const msgs: LogMessage[] = [];
        let seen = 0;

        // A chunk read through the ordinary reader is bounded by time rather
        // than by chunk, and adjacent chunks can overlap, so it can yield a
        // message a neighbour already produced.
        const emitted = new Set<string>();

        for await (const { item: chunk, result: parsed } of mapInOrder(
            candidates,
            CHUNK_CONCURRENCY,
            async (candidate) =>
                signal?.aborted
                    ? undefined
                    : this.readChunkByMessageIndex(
                          candidate,
                          channelIds,
                          undefined,
                          startTime,
                      ),
        )) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;

            // Fall back for the chunk that failed, not for the topic. Earlier
            // chunks have already reached the viewer by now -- that is the
            // point of emitting as they arrive -- so re-reading the topic from
            // the start would show all of those messages a second time.
            const source =
                parsed ??
                reader.readMessages({
                    topics: [topic],
                    startTime:
                        startTime !== undefined &&
                        startTime > chunk.messageStartTime
                            ? startTime
                            : chunk.messageStartTime,
                    endTime: chunk.messageEndTime,
                });

            for await (const message of source) {
                if (signal?.aborted) break;
                if (msgs.length >= limit) break;
                const key = messageIdentity(message);
                if (emitted.has(key)) continue;
                emitted.add(key);
                if (seen++ % keepEvery !== 0) continue;

                const channel = reader.channelsById.get(message.channelId);
                let data: unknown = message.data;
                if (channel) {
                    data =
                        (await this.tryDecode(
                            channel.schemaId,
                            message.data,
                        )) ?? message.data;
                }

                const messageObject = { logTime: message.logTime, data };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
            }
        }

        return msgs;
    }
    private async getMessagesProgressive(
        topic: string,
        keepEvery: number,
        limit: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        skip?: (logTime: bigint) => boolean,
        totalMessages?: number,
        window?: { start: bigint; end: bigint },
    ): Promise<LogMessage[]> {
        if (!this.reader || !this.httpReader) return [];
        const reader = this.reader;
        // Sampling positions are estimated for MCAP, so allow a little
        // headroom before stopping hard at the requested count.
        const hardLimit = Math.ceil(limit * 1.1) + 1;
        const msgs: LogMessage[] = [];
        const budget = new MainThreadBudget();

        const channelIds = new Set(
            [...reader.channelsById.values()]
                .filter((channel) => channel.topic === topic)
                .map((channel) => channel.id),
        );
        const chunks = this.topicChunks(channelIds);
        const order = window
            ? chunks
                  .map((chunk, index) => ({ chunk, index }))
                  .filter(
                      ({ chunk }) =>
                          chunk.messageEndTime >= window.start &&
                          chunk.messageStartTime < window.end,
                  )
                  .map(({ index }) => index)
            : coarseToFineOrder(chunks.length);

        // The chunk index does not store per-chunk message counts, so the
        // global position of a message is estimated from the average number
        // of messages per chunk. Sampling on that global position keeps the
        // samples uniform even when every chunk holds a single image.
        const averagePerChunk =
            totalMessages !== undefined && chunks.length > 0
                ? Math.max(1, totalMessages / chunks.length)
                : 1;
        // Exact when the chunk index shows each chunk's message count, which
        // also makes each message's position in the topic known.
        const exactOffsets = this.chunkOffsets(chunks, channelIds);
        const chunkOffsetOf = (chunkIndex: number): number =>
            exactOffsets?.[chunkIndex] ??
            Math.round(chunkIndex * averagePerChunk);

        // Adjacent chunks can overlap in time, so the same message may be
        // yielded twice. Log time, publish time and sequence number
        // together identify a message record well enough to drop only
        // true duplicates.
        const emitted = new Set<string>();

        // Chunks are read through a pool rather than one at a time, and by
        // addressing their messages rather than pulling them whole. Each chunk
        // costs an index read plus a few small ranges, and a sampled preview
        // visits hundreds of them, so the round trips are what the user waits
        // for. Results still arrive in coarse-to-fine order, so the preview
        // fills in across the whole recording as before.
        const visits: { chunkIndex: number; chunk: (typeof chunks)[number] }[] =
            [];
        for (const chunkIndex of order) {
            const chunk = chunks[chunkIndex];
            if (chunk) visits.push({ chunkIndex, chunk });
        }

        for await (const { item: visit, result: indexed } of mapInOrder(
            visits,
            CHUNK_CONCURRENCY,
            async ({ chunk, chunkIndex }) =>
                signal?.aborted
                    ? undefined
                    : // The core ChunkIndex carries every field this needs;
                      // McapChunkIndex is the local mirror of that shape.
                      this.readChunkByMessageIndex(
                          chunk as unknown as McapChunkIndex,
                          channelIds,
                          {
                              chunkOffset: chunkOffsetOf(chunkIndex),
                              keepEvery,
                          },
                          window?.start,
                          window?.end,
                      ),
        )) {
            if (signal?.aborted) break;
            if (msgs.length >= hardLimit) break;
            const { chunkIndex, chunk } = visit;

            let seen = 0;
            const chunkOffset = chunkOffsetOf(chunkIndex);

            const source =
                indexed ??
                reader.readMessages({
                    topics: [topic],
                    startTime:
                        window && window.start > chunk.messageStartTime
                            ? window.start
                            : chunk.messageStartTime,
                    endTime:
                        window && window.end - 1n < chunk.messageEndTime
                            ? window.end - 1n
                            : chunk.messageEndTime,
                });

            // The indexed reader already applied the stride from the index,
            // so re-applying it here would sample the samples.
            const preSampled = indexed !== undefined;

            for await (const message of source) {
                if (signal?.aborted) break;
                if (msgs.length >= hardLimit) break;
                if (!preSampled && (chunkOffset + seen++) % keepEvery !== 0) {
                    continue;
                }
                const key = messageIdentity(message);
                if (emitted.has(key)) continue;
                emitted.add(key);
                if (skip?.(message.logTime)) continue;

                let data = message.data;
                const channel = reader.channelsById.get(message.channelId);
                if (channel) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    data =
                        (await this.tryDecode(
                            channel.schemaId,
                            message.data,
                        )) ?? message.data;
                }
                const position =
                    'position' in message ? message.position : undefined;
                const messageObject = {
                    logTime: message.logTime,
                    index:
                        exactOffsets && position !== undefined
                            ? chunkOffset + position
                            : undefined,
                    data,
                };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
                await budget.yieldIfNeeded();
            }
        }
        return msgs;
    }

    /**
     * Read one chunk's messages for the wanted channels by addressing them
     * individually, or undefined when that is not possible for this chunk.
     *
     * The progressive reader visits a chunk at a time, and reading a chunk
     * whole costs its full size however little of it belongs to the topic --
     * on a recording that interleaves 60 kB camera frames with 200 byte
     * telemetry, that is the entire difference.
     */
    private async readChunkByMessageIndex(
        chunk: McapChunkIndex,
        channelIds: Set<number>,
        sampling?: { chunkOffset: number; keepEvery: number },
        startTime?: bigint,
        endTime?: bigint,
    ): Promise<ParsedChunkMessage[] | undefined> {
        // A failed range read must not take the topic down with it. Storage
        // answers a cancelled request with a 500, and a preview cancels
        // constantly -- collapsed panels, navigation, a re-login mid-load --
        // so returning undefined here hands the chunk back to the ordinary
        // reader instead of surfacing "Error reading <topic>".
        try {
            return await this.readChunkByMessageIndexUnsafe(
                chunk,
                channelIds,
                sampling,
                startTime,
                endTime,
            );
        } catch {
            return undefined;
        }
    }

    private async readChunkByMessageIndexUnsafe(
        chunk: McapChunkIndex,
        channelIds: Set<number>,
        sampling?: { chunkOffset: number; keepEvery: number },
        startTime?: bigint,
        endTime?: bigint,
    ): Promise<ParsedChunkMessage[] | undefined> {
        const httpReader = this.httpReader;
        if (!httpReader) return undefined;
        const compressed = chunk.compression !== '';
        if (compressed && !(chunk.compression in DECOMPRESS)) return undefined;
        if (chunk.messageIndexOffsets.size === 0) return undefined;

        let indexStart: bigint | undefined;
        for (const offset of chunk.messageIndexOffsets.values()) {
            if (indexStart === undefined || offset < indexStart) {
                indexStart = offset;
            }
        }
        if (indexStart === undefined) return undefined;

        const blob = await httpReader.readExact(
            indexStart,
            chunk.messageIndexLength,
        );
        const indexes = parseMessageIndexes(blob);
        if (indexes.size === 0) return undefined;

        // `startTime` matters here, not only when choosing chunks: an append
        // asks for everything after the last message it holds, and the chunk
        // straddling that boundary also holds the messages before it. Without
        // this the boundary chunk replays them, and an append has nowhere to
        // notice the duplicates.
        // Offsets in the index are relative to the chunk's uncompressed
        // data. Uncompressed, that maps onto the file; compressed, onto the
        // decompressed records read below.
        // Every message of the wanted channels, in time order, so that its
        // position in the chunk -- and so in the topic -- is known before the
        // time range narrows them down.
        const ordered = planChunk(
            compressed
                ? 0
                : chunkDataStart(
                      Number(chunk.chunkStartOffset),
                      chunk.compression,
                  ),
            Number(chunk.uncompressedSize),
            indexes,
            channelIds,
        ).toSorted((a, b) =>
            a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
        );
        const positionOf = new Map(
            ordered.map((extent, position) => [extent.start, position]),
        );

        // Sample before fetching, not after. A preview showing every 18th
        // message only needs every 18th record, and deciding that from the
        // index costs nothing -- fetching all of them and discarding the rest
        // costs eighteen times the bytes and requests.
        const chunkOffset = sampling?.chunkOffset ?? 0;
        const keepEvery = sampling?.keepEvery ?? 1;
        const extents = ordered.filter(
            (extent, position) =>
                (startTime === undefined || extent.logTime >= startTime) &&
                (endTime === undefined || extent.logTime < endTime) &&
                (chunkOffset + position) % keepEvery === 0,
        );
        if (extents.length === 0) return [];

        const out: ParsedChunkMessage[] = [];

        // A compressed chunk cannot be read in pieces, so it is fetched whole
        // -- exactly once, by its own offset. Asking the indexed reader for
        // the chunk's time range instead also loads every neighbour that
        // overlaps it in time, which on a recording interleaving two topics
        // doubled what a preview downloaded. The index read above already
        // decided that the chunk holds a sample, so no chunk is fetched for
        // nothing.
        if (compressed) {
            const records = await this.readChunkRecords(chunk);
            if (!records) return undefined;
            for (const extent of extents) {
                const parsed = parseMessageRecord(records, extent.start);
                if (!parsed) return undefined; // bail to the safe path
                out.push({ ...parsed, position: positionOf.get(extent.start) });
            }
            out.sort((a, b) =>
                a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
            );
            return out;
        }

        const gap =
            sampling && sampling.keepEvery > 1
                ? SAMPLED_COALESCE_GAP
                : PREVIEW_COALESCE_GAP;

        for await (const { item: range, result: buffer } of mapInOrder(
            coalesce(extents, gap),
            RANGE_CONCURRENCY,
            async (range) =>
                httpReader.readExact(
                    BigInt(range.start),
                    BigInt(range.end - range.start),
                ),
        )) {
            for (const extent of extents) {
                if (extent.start < range.start || extent.start >= range.end) {
                    continue;
                }
                const parsed = parseMessageRecord(
                    buffer,
                    extent.start - range.start,
                );
                if (!parsed) return undefined; // bail to the safe path
                out.push({ ...parsed, position: positionOf.get(extent.start) });
            }
        }

        out.sort((a, b) =>
            a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
        );
        return out;
    }

    /** Chunks holding messages of the given channels, in file order. */
    private topicChunks(channelIds: Set<number>): McapChunkIndex[] {
        if (!this.reader) return [];
        // The core ChunkIndex carries every field this needs; McapChunkIndex
        // is the local mirror of that shape.
        return (this.reader.chunkIndexes as unknown as McapChunkIndex[]).filter(
            (chunk) =>
                chunk.messageIndexOffsets
                    .keys()
                    .some((id: number) => channelIds.has(id)),
        );
    }

    /**
     * Messages of `channelIds` before each chunk, and their total as the last
     * entry, read from the chunk index alone; undefined when it does not tell.
     *
     * A channel's Message Index record holds one fixed-size entry per message,
     * and the records follow one another after their chunk, so the distance to
     * the next record (or to the end of the chunk's index section) gives the
     * count without reading anything.
     */
    private chunkOffsets(
        chunks: McapChunkIndex[],
        channelIds: Set<number>,
    ): number[] | undefined {
        const offsets: number[] = [];
        let cumulative = 0;
        for (const chunk of chunks) {
            offsets.push(cumulative);
            const end =
                chunk.chunkStartOffset +
                chunk.chunkLength +
                chunk.messageIndexLength;
            const starts = [...chunk.messageIndexOffsets.entries()].toSorted(
                (a, b) => (a[1] === b[1] ? 0 : a[1] < b[1] ? -1 : 1),
            );
            for (const [position, [channelId, start]] of starts.entries()) {
                if (!channelIds.has(channelId)) continue;
                const next = starts[position + 1]?.[1] ?? end;
                const entries =
                    (Number(next - start) - MESSAGE_INDEX_HEADER_LEN) /
                    MESSAGE_INDEX_ENTRY_LEN;
                if (!Number.isInteger(entries) || entries < 0) return undefined;
                cumulative += entries;
            }
        }
        offsets.push(cumulative);
        return offsets;
    }

    override sampleCost(topic: string, stride: number): number | undefined {
        const reader = this.reader;
        if (!reader) return undefined;
        const channelIds = new Set<number>();
        for (const [id, channel] of reader.channelsById) {
            if (channel.topic === topic) channelIds.add(id);
        }
        const chunks = this.topicChunks(channelIds);
        if (chunks.length === 0) return 0;
        // Uncompressed chunks address each message, so a sample costs only
        // its own bytes; the caller's per-message estimate is right there.
        if (chunks.some((chunk) => chunk.compression === '')) return undefined;

        // The same positions the progressive read samples on: exact from the
        // chunk index, or messages spread evenly over the chunks
        const exactOffsets = this.chunkOffsets(chunks, channelIds);
        let total = exactOffsets?.at(-1) ?? 0;
        if (!exactOffsets) {
            for (const id of channelIds) {
                total += Number(
                    reader.statistics?.channelMessageCounts.get(id) ?? 0,
                );
            }
        }
        if (total === 0) return undefined;
        const keepEvery = Math.max(1, Math.floor(stride));
        const perChunk = Math.max(1, total / chunks.length);
        let bytes = 0;
        for (const [index, chunk] of chunks.entries()) {
            const first = exactOffsets?.[index] ?? Math.round(index * perChunk);
            const next =
                exactOffsets?.[index + 1] ?? Math.round((index + 1) * perChunk);
            const firstSample = Math.ceil(first / keepEvery) * keepEvery;
            if (firstSample < next) bytes += Number(chunk.chunkLength);
        }
        return bytes;
    }

    /**
     * Fetch one Chunk record and return its decompressed records, or
     * undefined when it is not a chunk this can decompress.
     */
    private async readChunkRecords(
        chunk: McapChunkIndex,
    ): Promise<Uint8Array | undefined> {
        const httpReader = this.httpReader;
        const decompress = DECOMPRESS[chunk.compression];
        if (!httpReader || !decompress) return undefined;

        const record = await httpReader.readExact(
            chunk.chunkStartOffset,
            chunk.chunkLength,
        );
        // The records follow the fixed header fields and the compression
        // name, whose length the chunk index already gives.
        const recordsStart =
            CHUNK_HEADER_FIXED_LEN +
            new TextEncoder().encode(chunk.compression).length;
        if (record.length < recordsStart) return undefined;
        const view = new DataView(
            record.buffer,
            record.byteOffset,
            record.byteLength,
        );
        const recordsSize = Number(view.getBigUint64(recordsStart - 8, true));
        if (recordsStart + recordsSize > record.length) return undefined;
        const data = decompress(
            record.subarray(recordsStart, recordsStart + recordsSize),
        );
        if (data.length !== Number(chunk.uncompressedSize)) return undefined;
        return data;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private tryDecode(schemaId: number, data: Uint8Array): any {
        if (!this.reader) return;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let decoder = this.decoders.get(schemaId);
        if (!decoder) {
            const schema = this.reader.schemasById.get(schemaId);
            if (!schema) return;
            try {
                const isRos1 = schema.encoding.includes('ros1');
                // ROS 2 definitions use a different grammar (e.g. constants
                // with negative values), so the parser must know the dialect.
                const defs = parseMessageDefer(
                    new TextDecoder().decode(schema.data),
                    { ros2: !isRos1 },
                );
                if (isRos1) decoder = new Ros1Reader(defs);
                else if (['cdr', 'ros2msg'].includes(schema.encoding))
                    decoder = new CdrReader(defs);
                if (decoder) this.decoders.set(schemaId, decoder);
            } catch (error) {
                console.warn(
                    `Failed to parse schema ${schema.name} (${schema.encoding})`,
                    error,
                );
                return;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return decoder?.readMessage(data);
    }
}
