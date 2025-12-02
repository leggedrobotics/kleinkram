import { UniversalHttpReader } from '@common/universal-http-reader';
import { Bag } from '@foxglove/rosbag';
import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import { McapIndexedReader } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';

export interface LogMessage {
    logTime: bigint;
    data: any;
}

export interface LogStrategy {
    init(reader: UniversalHttpReader): Promise<void>;
    getMessages(
        topic: string,
        limit?: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
    ): Promise<LogMessage[]>;
}

// --- MCAP Implementation ---
export class McapStrategy implements LogStrategy {
    private reader: McapIndexedReader | null = null;
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
    ): Promise<LogMessage[]> {
        if (!this.reader || !this.httpReader) return [];
        const msgs: LogMessage[] = [];

        const options: any = { topics: [topic] };
        if (startTime !== undefined) options.startTime = startTime;

        // Prefetch chunks
        // We need to access private chunkIndexes, but McapIndexedReader exposes them publicly in recent versions
        // or we can cast to any if needed. The source code showed `chunkIndexes` as a property.
        const chunkIndexes = (this.reader as any).chunkIndexes as any[];
        if (chunkIndexes) {
            const relevantChunks = chunkIndexes.filter(
                (c) =>
                    // Check if chunk overlaps with our interest
                    // If startTime is set, chunk must end after it
                    (startTime === undefined ||
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
                    chunk.chunkStartOffset,
                    chunk.chunkLength,
                );
            }
        }

        for await (const message of this.reader.readMessages(options)) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;
            let data = message.data;
            const channel = this.reader.channelsById.get(message.channelId);
            if (channel) {
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

    private tryDecode(schemaId: number, data: Uint8Array): any {
        if (!this.reader) return;
        let decoder = this.decoders.get(schemaId);
        if (!decoder) {
            const schema = this.reader.schemasById.get(schemaId);
            if (!schema) return;
            try {
                const defs = parseMessageDefer(
                    new TextDecoder().decode(schema.data),
                );
                if (schema.encoding.includes('ros1'))
                    decoder = new Ros1Reader(defs);
                else if (['cdr', 'ros2msg'].includes(schema.encoding))
                    decoder = new CdrReader(defs);
                if (decoder) this.decoders.set(schemaId, decoder);
            } catch {
                return;
            }
        }
        return decoder?.readMessage(data);
    }
}

// --- Rosbag Implementation ---
export class RosbagStrategy implements LogStrategy {
    private bag: Bag | undefined = undefined;
    private httpReader: UniversalHttpReader | null = null;

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.httpReader = httpReader;
        this.bag = new Bag(
            {
                read: (offset, length): Promise<Uint8Array> =>
                    httpReader.read(BigInt(offset), BigInt(length)),
                size: (): number => httpReader.sizeBytes,
            },
            {
                decompress: {
                    zstd: (buffer): Uint8Array => fzstd.decompress(buffer),
                    lz4: (buffer): Uint8Array => lz4js.decompress(buffer),
                },
            },
        );
        await this.bag.open();
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
    ): Promise<LogMessage[]> {
        if (!this.bag || !this.httpReader) return [];
        const msgs: LogMessage[] = [];

        // eslint-disable-next-line unicorn/consistent-function-scoping
        const toNano = (t: { sec: number; nsec: number }) =>
            BigInt(t.sec) * 1_000_000_000n + BigInt(t.nsec);

        let start: { sec: number; nsec: number } | undefined;
        if (startTime !== undefined) {
            const sec = Number(startTime / 1_000_000_000n);
            const nsec = Number(startTime % 1_000_000_000n);
            start = { sec, nsec };
        }

        const options: any = { topics: [topic] };
        if (start) options.startTime = start;

        // Prefetch chunks
        const chunkInfos = this.bag.chunkInfos;
        if (chunkInfos) {
            // Helper to compare ros times
            const compareTime = (
                a: { sec: number; nsec: number },
                b: { sec: number; nsec: number },
            ) => {
                if (a.sec !== b.sec) return a.sec - b.sec;
                return a.nsec - b.nsec;
            };

            const relevantChunks = chunkInfos.filter(
                (c) =>
                    // Check if chunk overlaps with our interest
                    // If start is set, chunk must end after it
                    start === undefined || compareTime(c.endTime, start) >= 0,
            );

            // Prefetch the first few chunks
            const chunksToPrefetch = relevantChunks.slice(0, 5);

            for (const chunk of chunksToPrefetch) {
                let size = 0n;
                const index = chunkInfos.indexOf(chunk);

                if (index !== -1 && index < chunkInfos.length - 1) {
                    const nextChunk = chunkInfos[index + 1];
                    if (nextChunk) {
                        size = BigInt(
                            nextChunk.chunkPosition - chunk.chunkPosition,
                        );
                    }
                } else if (this.bag.header) {
                    // Last chunk, ends at indexPosition
                    size = BigInt(
                        this.bag.header.indexPosition - chunk.chunkPosition,
                    );
                }

                // If we couldn't determine size or it's suspiciously small/large, maybe default to something?
                // But usually the above logic covers it.
                // Note: chunkPosition includes the header, so fetching from chunkPosition with size
                // should cover the whole chunk record + data.

                if (size > 0n) {
                    this.httpReader.prefetch(BigInt(chunk.chunkPosition), size);
                }
            }
        }

        const iterator = this.bag.messageIterator(options);

        for await (const result of iterator) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;
            const messageObject = {
                logTime: toNano(result.timestamp),
                data: result.message,
            };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
        }
        return msgs;
    }
}
