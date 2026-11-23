import { Bag } from '@foxglove/rosbag';
import { parse as parseMessageDefinition } from '@foxglove/rosmsg';
import { MessageReader } from '@foxglove/rosmsg-serialization';
import { UniversalHttpReader } from '@kleinkram/shared';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { mapInOrder } from './fetch-pool';
import { DecodingStrategy } from './index';
import {
    coarseToFineOrder,
    LogMessage,
    MainThreadBudget,
    ReadOptions,
} from './utilities';

const decompress = {
    zstd: (buffer: Uint8Array): Uint8Array => fzstd.decompress(buffer),
    lz4: (buffer: Uint8Array): Uint8Array => lz4js.decompress(buffer),
};

/**
 * Chunks fetched at once in the progressive path. A sampled image preview
 * visits hundreds of chunks of about a megabyte each; one at a time leaves the
 * connection idle for a round trip between every two of them. Browsers keep
 * about six connections per host over HTTP/1.1.
 */
const CHUNK_CONCURRENCY = 6;

/**
 * Reads at least this long are taken exactly as asked. The bag reader asks for
 * whole chunks, and inflating those to the streaming read-ahead size fetches
 * most of the neighbouring chunk as well -- which the coarse-to-fine order
 * then does not read next.
 */
const EXACT_READ_THRESHOLD = 64 * 1024;

type ChunkInfo = NonNullable<Bag['chunkInfos'][number]>;

const toNano = (t: { sec: number; nsec: number }): bigint =>
    BigInt(t.sec) * 1_000_000_000n + BigInt(t.nsec);

const compareTime = (
    a: { sec: number; nsec: number },
    b: { sec: number; nsec: number },
): number => (a.sec === b.sec ? a.nsec - b.nsec : a.sec - b.sec);

export class RosbagStrategy extends DecodingStrategy {
    private bag: Bag | undefined = undefined;
    private httpReader: UniversalHttpReader | null = null;

    override readonly supportsWindow = true;

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.httpReader = httpReader;
        this.bag = new Bag(
            {
                read: (offset, length): Promise<Uint8Array> =>
                    length >= EXACT_READ_THRESHOLD
                        ? httpReader.readExact(BigInt(offset), BigInt(length))
                        : httpReader.read(BigInt(offset), BigInt(length)),
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
     * The chunks a sampled read of `topic` has to fetch, in file order, with
     * the topic's global message index at each chunk's start.
     *
     * A chunk is compressed as a whole, so it costs its full size however few
     * of its messages are kept; a chunk holding none of the samples is left
     * out. Within `window`, only chunks overlapping that time range count.
     */
    private selectChunks(
        connectionIds: Set<number>,
        keepEvery: number,
        window?: { start: bigint; end: bigint },
    ): { chunk: ChunkInfo; index: number; offset: number }[] {
        if (!this.bag) return [];
        const selected: { chunk: ChunkInfo; index: number; offset: number }[] =
            [];
        let cumulative = 0;
        for (const [index, chunk] of this.bag.chunkInfos.entries()) {
            let count = 0;
            for (const c of chunk.connections) {
                if (connectionIds.has(c.conn)) count += c.count;
            }
            if (count === 0) continue;
            const offset = cumulative;
            cumulative += count;
            const firstSample = Math.ceil(offset / keepEvery) * keepEvery;
            if (firstSample >= offset + count) continue;
            if (
                window &&
                (toNano(chunk.endTime) < window.start ||
                    toNano(chunk.startTime) >= window.end)
            ) {
                continue;
            }
            selected.push({ chunk, index, offset });
        }
        return selected;
    }

    private connectionIdsOf(topic: string): Set<number> {
        if (!this.bag) return new Set();
        return new Set(
            [...this.bag.connections.values()]
                .filter((connection) => connection.topic === topic)
                .map((connection) => connection.conn),
        );
    }

    override sampleCost(topic: string, stride: number): number | undefined {
        if (!this.bag) return undefined;
        const keepEvery = Math.max(1, Math.floor(stride));
        let bytes = 0;
        for (const { index } of this.selectChunks(
            this.connectionIdsOf(topic),
            keepEvery,
        )) {
            bytes += Number(this.chunkByteLength(index));
        }
        return bytes;
    }

    /**
     * Reads the chunks holding samples of `topic` a few at a time, either
     * coarse-to-fine (first, last, middle, ...) so a preview covering the
     * whole recording appears early, or -- within a time window -- in time
     * order, for playback.
     */
    private async getMessagesProgressive(
        topic: string,
        keepEvery: number,
        limit: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        skip?: (logTime: bigint) => boolean,
        window?: { start: bigint; end: bigint },
    ): Promise<LogMessage[]> {
        if (!this.bag || !this.httpReader) return [];
        const bag = this.bag;
        const hardLimit = Math.ceil(limit * 1.1) + 1;
        const msgs: LogMessage[] = [];
        const budget = new MainThreadBudget();

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

        const chunks = this.selectChunks(connectionIds, keepEvery, window);
        const order = window
            ? chunks.map((_chunk, index) => index)
            : coarseToFineOrder(chunks.length);

        for await (const { item: entryIndex, result: records } of mapInOrder(
            order,
            CHUNK_CONCURRENCY,
            async (entryIndex) => {
                const entry = chunks[entryIndex];
                if (!entry || signal?.aborted) return [];
                return bag.reader.readChunkMessages(
                    entry.chunk,
                    [...connectionIds],
                    entry.chunk.startTime,
                    entry.chunk.endTime,
                    decompress,
                );
            },
        )) {
            if (signal?.aborted) break;
            if (msgs.length >= hardLimit) break;

            let seen = 0;
            const chunkOffset = chunks[entryIndex]?.offset ?? 0;
            for (const record of records) {
                if (signal?.aborted) break;
                if (msgs.length >= hardLimit) break;
                if ((chunkOffset + seen++) % keepEvery !== 0) continue;
                if (!record.data) continue;
                const logTime = toNano(record.time);
                if (
                    window &&
                    (logTime < window.start || logTime >= window.end)
                ) {
                    continue;
                }
                if (skip?.(logTime)) continue;
                const reader = readers.get(record.conn);
                const messageObject: LogMessage = {
                    logTime,
                    index: chunkOffset + seen - 1,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    data: reader
                        ? reader.readMessage(record.data)
                        : record.data,
                };
                if (onMessage) onMessage(messageObject);
                msgs.push(messageObject);
                await budget.yieldIfNeeded();
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
                options.window,
            );
        }

        const msgs: LogMessage[] = [];
        const budget = new MainThreadBudget();
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
                // Counted from the topic's start unless the read began later
                index: start === undefined ? seen - 1 : undefined,
                data: result.message,
            };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
            await budget.yieldIfNeeded();
        }
        return msgs;
    }
}
