import { Bag } from '@foxglove/rosbag';
import { parse as parseMessageDefinition } from '@foxglove/rosmsg';
import { MessageReader } from '@foxglove/rosmsg-serialization';
import { UniversalHttpReader } from '@kleinkram/shared';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { DecodingStrategy } from './index';
import { coarseToFineOrder, LogMessage, ReadOptions } from './utilities';

const decompress = {
    zstd: (buffer: Uint8Array): Uint8Array => fzstd.decompress(buffer),
    lz4: (buffer: Uint8Array): Uint8Array => lz4js.decompress(buffer),
};

const toNano = (t: { sec: number; nsec: number }): bigint =>
    BigInt(t.sec) * 1_000_000_000n + BigInt(t.nsec);

const compareTime = (
    a: { sec: number; nsec: number },
    b: { sec: number; nsec: number },
): number => (a.sec === b.sec ? a.nsec - b.nsec : a.sec - b.sec);

export class RosbagStrategy extends DecodingStrategy {
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
            { decompress },
        );
        await this.bag.open();
    }

    /**
     * Byte length of a chunk record, derived from the position of the next
     * chunk (or of the index section for the last chunk).
     */
    private chunkByteLength(chunkIndex: number): bigint {
        if (!this.bag) return 0n;
        const chunkInfos = this.bag.chunkInfos;
        const chunk = chunkInfos[chunkIndex];
        if (!chunk) return 0n;
        const next = chunkInfos[chunkIndex + 1];
        if (next) return BigInt(next.chunkPosition - chunk.chunkPosition);
        if (this.bag.header) {
            return BigInt(this.bag.header.indexPosition - chunk.chunkPosition);
        }
        return 0n;
    }

    private prefetchChunk(chunkIndex: number): void {
        if (!this.bag || !this.httpReader) return;
        const chunk = this.bag.chunkInfos[chunkIndex];
        const size = this.chunkByteLength(chunkIndex);
        if (chunk && size > 0n) {
            this.httpReader.prefetch(BigInt(chunk.chunkPosition), size);
        }
    }

    /**
     * Reads the chunks containing `topic` coarse-to-fine (first, last,
     * middle, ...) directly through the bag reader, one chunk per request,
     * so a preview covering the whole recording appears early.
     */
    private async getMessagesProgressive(
        topic: string,
        keepEvery: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        skip?: (logTime: bigint) => boolean,
    ): Promise<LogMessage[]> {
        if (!this.bag || !this.httpReader) return [];
        const bag = this.bag;
        const msgs: LogMessage[] = [];

        const connections = [...bag.connections.values()].filter(
            (connection) => connection.topic === topic,
        );
        const connectionIds = new Set(connections.map((c) => c.conn));
        if (connectionIds.size === 0) return [];

        // Lazily create one decoder per connection (same as the bag does)
        for (const connection of connections) {
            connection.reader ??= new MessageReader(
                parseMessageDefinition(connection.messageDefinition),
            );
        }
        const readers = new Map(
            connections.map((connection) => [
                connection.conn,
                connection.reader,
            ]),
        );

        const chunkIndexes = bag.chunkInfos
            .map((chunk, index) => ({ chunk, index }))
            .filter(({ chunk }) =>
                chunk.connections.some((c) => connectionIds.has(c.conn)),
            );
        const order = coarseToFineOrder(chunkIndexes.length);

        // Exact global position of each chunk's first message of the topic,
        // so that sampling stays uniform across chunks of any size.
        const chunkOffsets: number[] = [];
        let cumulative = 0;
        for (const { chunk } of chunkIndexes) {
            chunkOffsets.push(cumulative);
            for (const c of chunk.connections) {
                if (connectionIds.has(c.conn)) cumulative += c.count;
            }
        }

        const PREFETCH_AHEAD = 3;
        for (const [position, entryIndex] of order.entries()) {
            if (signal?.aborted) break;
            const entry = chunkIndexes[entryIndex];
            if (!entry) continue;

            for (let ahead = 0; ahead < PREFETCH_AHEAD; ahead++) {
                const upcoming = chunkIndexes[order[position + ahead] ?? -1];
                if (upcoming) this.prefetchChunk(upcoming.index);
            }

            const records = await bag.reader.readChunkMessages(
                entry.chunk,
                [...connectionIds],
                entry.chunk.startTime,
                entry.chunk.endTime,
                decompress,
            );

            let seen = 0;
            const chunkOffset = chunkOffsets[entryIndex] ?? 0;
            for (const record of records) {
                if (signal?.aborted) break;
                if ((chunkOffset + seen++) % keepEvery !== 0) continue;
                if (!record.data) continue;
                const logTime = toNano(record.time);
                if (skip?.(logTime)) continue;
                const reader = readers.get(record.conn);
                const messageObject: LogMessage = {
                    logTime,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    data: reader
                        ? reader.readMessage(record.data)
                        : record.data,
                };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
            }
        }
        return msgs;
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
        options: ReadOptions = {},
    ): Promise<LogMessage[]> {
        if (!this.bag || !this.httpReader) return [];
        const keepEvery = Math.max(1, Math.floor(options.stride ?? 1));

        if (options.progressive && startTime === undefined) {
            return this.getMessagesProgressive(
                topic,
                keepEvery,
                onMessage,
                signal,
                options.skip,
            );
        }

        const msgs: LogMessage[] = [];
        let seen = 0;

        let start: { sec: number; nsec: number } | undefined;
        if (startTime !== undefined) {
            const sec = Number(startTime / 1_000_000_000n);
            const nsec = Number(startTime % 1_000_000_000n);
            start = { sec, nsec };
        }

        const iteratorOptions: {
            topics: string[];
            start?: { sec: number; nsec: number };
        } = { topics: [topic] };
        if (start) iteratorOptions.start = start;

        // Prefetch the first few chunks that can contain messages of interest
        const chunkInfos = this.bag.chunkInfos;
        let prefetched = 0;
        for (const [index, chunk] of chunkInfos.entries()) {
            if (prefetched >= 5) break;
            if (start !== undefined && compareTime(chunk.endTime, start) < 0) {
                continue;
            }
            this.prefetchChunk(index);
            prefetched++;
        }

        const iterator = this.bag.messageIterator(iteratorOptions);

        for await (const result of iterator) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;
            if (seen++ % keepEvery !== 0) continue;
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
