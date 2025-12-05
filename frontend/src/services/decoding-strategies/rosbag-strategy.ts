import { Bag } from '@foxglove/rosbag';
import { UniversalHttpReader } from '@kleinkram/shared';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { DecodingStrategy } from './index';
import { LogMessage } from './utilities';

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = { topics: [topic] };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (start) options.startTime = start;

        // Prefetch chunks
        const chunkInfos = this.bag.chunkInfos;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
