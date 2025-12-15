import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import { UniversalHttpReader } from '@kleinkram/shared';
import { McapIndexedReader } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import { DecodingStrategy } from './index';
import { LogMessage } from './utilities';

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
    ): Promise<LogMessage[]> {
        if (!this.reader || !this.httpReader) return [];
        const msgs: LogMessage[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = { topics: [topic] };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (startTime !== undefined) options.startTime = startTime;

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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for await (const message of this.reader.readMessages(options)) {
            if (signal?.aborted) break;
            if (msgs.length >= limit) break;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private tryDecode(schemaId: number, data: Uint8Array): any {
        if (!this.reader) return;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return decoder?.readMessage(data);
    }
}
