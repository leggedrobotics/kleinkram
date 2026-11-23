import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import {
    computeTopicStats,
    RecordingChannel,
    RecordingChunk,
    StoredTopicStats,
} from '@kleinkram/shared';
import { McapIndexedReader } from '@mcap/core';
import { RosTime, toNanoseconds } from './time';

/**
 * Per-topic statistics by topic name. Empty when the file's index does not
 * say which topics each chunk holds.
 */
export type TopicStatsByName = Map<string, StoredTopicStats>;

/**
 * The topic columns {@link StoredTopicStats} fill, null for a topic without
 * statistics. `frequency` is not among them: where the statistics are
 * unknown, the existing frequency stays.
 */
export function topicStatsColumns(
    stats: StoredTopicStats | undefined,
): Pick<TopicEntity, 'firstSeen' | 'lastSeen' | 'chunkCount' | 'coverage'> {
    return {
        firstSeen: stats?.firstSeen ?? null,
        lastSeen: stats?.lastSeen ?? null,
        chunkCount: stats?.chunkCount ?? null,
        coverage: stats?.coverage ?? null,
    };
}

/**
 * Reads the statistics from the summary section of an MCAP, the same way the
 * file page does in the browser.
 */
export function mcapTopicStats(reader: McapIndexedReader): TopicStatsByName {
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
    const channels: RecordingChannel[] = [...reader.channelsById.values()].map(
        (channel) => {
            const count = counts?.get(channel.id);
            return {
                id: channel.id,
                topic: channel.topic,
                messageCount: count === undefined ? undefined : Number(count),
            };
        },
    );

    return computeTopicStats(chunks, channels);
}

/** The parts of an opened `@foxglove/rosbag` `Bag` the statistics need. */
export interface BagIndex {
    connections: Map<number, { conn: number; topic: string }>;
    chunkInfos: {
        startTime: RosTime;
        endTime: RosTime;
        connections: { conn: number; count: number }[];
    }[];
}

/**
 * Reads the statistics from the index at the end of a ROS 1 bag.
 *
 * Every chunk info record lists the chunk's time range and how many messages
 * of each connection it holds, which is all an MCAP chunk index offers too.
 * The index always names the connections, so unlike an MCAP a bag never lacks
 * a message index.
 */
export function bagTopicStats(bag: BagIndex): TopicStatsByName {
    const counts = new Map<number, number>();
    const chunks: RecordingChunk[] = [];

    for (const chunkInfo of bag.chunkInfos) {
        const startTime = toNanoseconds(chunkInfo.startTime);
        const endTime = toNanoseconds(chunkInfo.endTime);
        if (startTime === undefined || endTime === undefined) continue;

        const channelIds: number[] = [];
        for (const { conn, count } of chunkInfo.connections) {
            counts.set(conn, (counts.get(conn) ?? 0) + count);
            if (count > 0) channelIds.push(conn);
        }

        chunks.push({
            startTime,
            endTime,
            // Only known from the chunk records themselves, which the index
            // does not repeat; coverage does not need them.
            compression: '',
            compressedSize: 0n,
            uncompressedSize: 0n,
            channelIds,
            hasMessageIndex: true,
        });
    }

    const channels: RecordingChannel[] = [...bag.connections.values()].map(
        (connection) => ({
            id: connection.conn,
            topic: connection.topic,
            messageCount: counts.get(connection.conn) ?? 0,
        }),
    );

    return computeTopicStats(chunks, channels);
}
