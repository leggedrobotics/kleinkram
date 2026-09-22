import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import {
    chunkDataStart,
    coalesce,
    MessageExtent,
    parseMessageIndexes,
    parseMessageRecord,
    planChunk,
    UniversalHttpReader,
} from '@kleinkram/shared';
import { McapIndexedReader } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { mapInOrder } from './fetch-pool';
import { DecodingStrategy } from './index';
import { coarseToFineOrder, LogMessage, ReadOptions } from './utilities';

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
 * Range reads in flight at once.
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

/** What `parseMessageRecord` yields, shaped like `@mcap/core`'s message. */
interface ParsedChunkMessage {
    channelId: number;
    sequence: number;
    logTime: bigint;
    publishTime: bigint;
    data: Uint8Array;
}

export class McapStrategy extends DecodingStrategy {
    private reader: McapIndexedReader | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private decoders = new Map<number, any>();
    private httpReader: UniversalHttpReader | null = null;

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.httpReader = httpReader;
        this.reader = await McapIndexedReader.Initialize({
            readable: httpReader,
            decompressHandlers: {
                zstd: (buffer: Uint8Array) => fzstd.decompress(buffer),
                lz4: (buffer: Uint8Array) => lz4js.decompress(buffer),
                bz2: () => {
                    throw new Error('BZ2 not supported');
                },
            },
        });
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

        if (options.progressive && startTime === undefined) {
            return this.getMessagesProgressive(
                topic,
                keepEvery,
                limit,
                onMessage,
                signal,
                options.skip,
                options.totalMessages,
            );
        }

        const msgs: LogMessage[] = [];
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
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

        // A preview of the first messages needs only the chunks that hold
        // them; a sampled preview of a dense topic needs all of them, because
        // striding runs across the whole recording. Plan only as far as the
        // request actually reaches.
        const needExtents = limit * keepEvery;

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

        // Index reads are small, independent and numerous -- hundreds of them
        // for a sampled preview -- so they go through the pool rather than one
        // round trip at a time.
        const extents: MessageExtent[] = [];
        let planningFailed = false;

        for await (const { item: chunk, result: blob } of mapInOrder(
            candidates,
            FETCH_CONCURRENCY,
            async (chunk) => {
                let indexStart: bigint | undefined;
                for (const offset of chunk.messageIndexOffsets.values()) {
                    if (indexStart === undefined || offset < indexStart) {
                        indexStart = offset;
                    }
                }
                // readExact, not read: `read` inflates every request to its
                // minimum streaming size, which would pull hundreds of kB to
                // get an 8 kB index.
                return indexStart === undefined
                    ? undefined
                    : httpReader.readExact(
                          indexStart,
                          chunk.messageIndexLength,
                      );
            },
        )) {
            if (signal?.aborted || blob === undefined) {
                planningFailed = true;
                break;
            }
            const indexes = parseMessageIndexes(blob);
            if (indexes.size === 0) {
                planningFailed = true;
                break;
            }
            extents.push(
                ...planChunk(
                    chunkDataStart(
                        Number(chunk.chunkStartOffset),
                        chunk.compression,
                    ),
                    Number(chunk.uncompressedSize),
                    indexes,
                    channelIds,
                    startTime,
                ),
            );
            if (extents.length >= needExtents) break;
        }
        if (planningFailed) return undefined;

        extents.sort((a, b) =>
            a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
        );

        // Only the records that survive striding are worth fetching, and the
        // preview stops at `limit`.
        const needed = extents
            .filter((_extent, index) => index % keepEvery === 0)
            .slice(0, limit);
        if (needed.length === 0) return [];

        const wantedStarts = new Set(needed.map((extent) => extent.start));
        const msgs: LogMessage[] = [];

        for await (const { item: range, result: buffer } of mapInOrder(
            coalesce(needed, PREVIEW_COALESCE_GAP),
            FETCH_CONCURRENCY,
            async (range) =>
                httpReader.readExact(
                    BigInt(range.start),
                    BigInt(range.end - range.start),
                ),
        )) {
            if (signal?.aborted) break;

            for (const extent of needed) {
                if (extent.start < range.start || extent.start >= range.end) {
                    continue;
                }
                if (!wantedStarts.has(extent.start)) continue;

                const parsed = parseMessageRecord(
                    buffer,
                    extent.start - range.start,
                );
                if (!parsed) return undefined; // bail to the safe path

                const channel = reader.channelsById.get(parsed.channelId);
                let data: unknown = parsed.data;
                if (channel) {
                    data =
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        (await this.tryDecode(channel.schemaId, parsed.data)) ??
                        parsed.data;
                }

                const messageObject = { logTime: parsed.logTime, data };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
            }
        }

        msgs.sort((a, b) =>
            a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
        );
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
    ): Promise<LogMessage[]> {
        if (!this.reader || !this.httpReader) return [];
        const reader = this.reader;
        // Sampling positions are estimated for MCAP, so allow a little
        // headroom before stopping hard at the requested count.
        const hardLimit = Math.ceil(limit * 1.1) + 1;
        const msgs: LogMessage[] = [];

        const channelIds = new Set(
            [...reader.channelsById.values()]
                .filter((channel) => channel.topic === topic)
                .map((channel) => channel.id),
        );
        const chunks = reader.chunkIndexes.filter((chunk) =>
            chunk.messageIndexOffsets
                .keys()
                .some((id: number) => channelIds.has(id)),
        );
        const order = coarseToFineOrder(chunks.length);

        // The chunk index does not store per-chunk message counts, so the
        // global position of a message is estimated from the average number
        // of messages per chunk. Sampling on that global position keeps the
        // samples uniform even when every chunk holds a single image.
        const averagePerChunk =
            totalMessages !== undefined && chunks.length > 0
                ? Math.max(1, totalMessages / chunks.length)
                : 1;

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
            async ({ chunk }) =>
                signal?.aborted
                    ? undefined
                    : // The core ChunkIndex carries every field this needs;
                      // McapChunkIndex is the local mirror of that shape.
                      this.readChunkByMessageIndex(
                          chunk as unknown as McapChunkIndex,
                          channelIds,
                      ),
        )) {
            if (signal?.aborted) break;
            if (msgs.length >= hardLimit) break;
            const { chunkIndex, chunk } = visit;

            let seen = 0;
            const chunkOffset = Math.round(chunkIndex * averagePerChunk);

            const source =
                indexed ??
                reader.readMessages({
                    topics: [topic],
                    startTime: chunk.messageStartTime,
                    endTime: chunk.messageEndTime,
                });

            for await (const message of source) {
                if (signal?.aborted) break;
                if (msgs.length >= hardLimit) break;
                if ((chunkOffset + seen++) % keepEvery !== 0) continue;
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
                const messageObject = { logTime: message.logTime, data };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
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
    ): Promise<ParsedChunkMessage[] | undefined> {
        const httpReader = this.httpReader;
        if (!httpReader) return undefined;
        if (chunk.compression !== '') return undefined;
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

        const extents = planChunk(
            chunkDataStart(Number(chunk.chunkStartOffset), chunk.compression),
            Number(chunk.uncompressedSize),
            indexes,
            channelIds,
        );
        if (extents.length === 0) return [];

        const out: ParsedChunkMessage[] = [];
        for await (const { item: range, result: buffer } of mapInOrder(
            coalesce(extents, PREVIEW_COALESCE_GAP),
            FETCH_CONCURRENCY,
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
                out.push(parsed);
            }
        }

        out.sort((a, b) =>
            a.logTime === b.logTime ? 0 : a.logTime < b.logTime ? -1 : 1,
        );
        return out;
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
