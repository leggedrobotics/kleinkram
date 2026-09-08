import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import { UniversalHttpReader } from '@kleinkram/shared';
import { McapIndexedReader } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { DecodingStrategy } from './index';
import { coarseToFineOrder, LogMessage, ReadOptions } from './utilities';

/** Identity of a message record, used to drop duplicates from overlapping chunks */
const messageIdentity = (message: {
    logTime: bigint;
    publishTime: bigint;
    sequence: number;
}): string =>
    `${String(message.logTime)}:${String(message.publishTime)}:${String(message.sequence)}`;

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
        const httpReader = this.httpReader;
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

        const PREFETCH_AHEAD = 3;
        for (const [position, chunkIndex] of order.entries()) {
            if (signal?.aborted) break;
            if (msgs.length >= hardLimit) break;
            const chunk = chunks[chunkIndex];
            if (!chunk) continue;

            for (let ahead = 0; ahead < PREFETCH_AHEAD; ahead++) {
                const upcoming = chunks[order[position + ahead] ?? -1];
                if (upcoming) {
                    httpReader.prefetch(
                        upcoming.chunkStartOffset,
                        upcoming.chunkLength,
                    );
                }
            }

            let seen = 0;
            const chunkOffset = Math.round(chunkIndex * averagePerChunk);
            for await (const message of reader.readMessages({
                topics: [topic],
                startTime: chunk.messageStartTime,
                endTime: chunk.messageEndTime,
            })) {
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
