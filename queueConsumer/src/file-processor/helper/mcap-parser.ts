// src/modules/file-processor/helper/mcap-parser.ts
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { McapIndexedReader } from '@mcap/core';
import { FileHandleReadable } from '@mcap/nodejs';
import { loadDecompressHandlers } from '@mcap/support';
import { open } from 'node:fs/promises';
import logger from '../../logger';

export interface McapMetadata {
    topics: Partial<TopicEntity>[];
    date: Date;
    size: number;
}

export class McapParser {
    /**
     * Parses an MCAP file to extract topic statistics and recording date.
     * Uses 'await using' to guarantee file closure.
     */
    static async extractMetadata(filePath: string): Promise<McapMetadata> {
        const fileHandle = await open(filePath, 'r');

        const { size } = await fileHandle.stat();
        const decompressHandlers = await loadDecompressHandlers();

        const reader = await McapIndexedReader.Initialize({
            readable: new FileHandleReadable(fileHandle),
            decompressHandlers,
        });

        if (!reader.statistics) {
            logger.warn(`No statistics found in MCAP: ${filePath}`);
            return { topics: [], date: new Date(), size };
        }

        return {
            topics: this.mapChannelsToTopics(reader),
            date: new Date(
                Number(reader.statistics.messageStartTime / 1_000_000n),
            ), // nanoseconds to millis
            size,
        };
    }

    private static mapChannelsToTopics(
        reader: McapIndexedReader,
    ): Partial<TopicEntity>[] {
        const stats = reader.statistics;

        if (!stats) {
            return [];
        }

        const durationNs = stats.messageEndTime - stats.messageStartTime;
        const durationSec = Number(durationNs) / 1_000_000_000;

        const topics: Partial<TopicEntity>[] = [];

        for (const [, channel] of reader.channelsById) {
            const schema = reader.schemasById.get(channel.schemaId);
            if (!schema) continue;

            const messageCount =
                stats.channelMessageCounts.get(channel.id) ?? 0n;

            // Calculate frequency safely avoiding divide by zero
            const frequency =
                durationSec > 0 ? Number(messageCount) / durationSec : 0;

            topics.push({
                name: channel.topic,
                type: schema.name,
                nrMessages: messageCount,
                messageEncoding: channel.messageEncoding,
                frequency,
            });
        }

        return topics;
    }
}
