import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import { Repository } from 'typeorm';
import { AbstractMetadataService } from './abstract-metadata.service';
import { ExtractedTopicInfo } from './file-handler.interface';

@Injectable()
export class Db3MetadataService extends AbstractMetadataService {
    constructor(
        @InjectRepository(TopicEntity) topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        fileEventRepo: Repository<FileEventEntity>,
    ) {
        super(topicRepo, fileRepo, fileEventRepo);
    }

    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        const fileSize = fs.statSync(filePath).size;

        const database = new Database(filePath, { readonly: true });

        try {
            // Get Topics
            const topics = database
                .prepare('SELECT id, name, type FROM topics')
                .all() as { id: number; name: string; type: string }[];

            // Get Message Counts
            const counts = database
                .prepare(
                    'SELECT topic_id, COUNT(*) as count FROM messages GROUP BY topic_id',
                )

                // eslint-disable-next-line @typescript-eslint/naming-convention
                .all() as { topic_id: number; count: number }[];

            const countMap = new Map<number, number>();
            for (const c of counts) {
                countMap.set(c.topic_id, c.count);
            }

            const timeRange = database
                .prepare(
                    `SELECT
                        CAST(MIN(timestamp) AS TEXT) as minTimestamp,
                        CAST(MAX(timestamp) AS TEXT) as maxTimestamp
                    FROM messages`,
                )
                .get() as
                | { minTimestamp: string | null; maxTimestamp: string | null }
                | undefined;
            const startTimeNs = toBigIntOrUndefined(timeRange?.minTimestamp);
            const endTimeNs = toBigIntOrUndefined(timeRange?.maxTimestamp);
            const durationSec = getDurationSeconds(startTimeNs, endTimeNs);

            const rawTopics: ExtractedTopicInfo[] = topics.map((t) => ({
                frequency:
                    durationSec > 0
                        ? (countMap.get(t.id) ?? 0) / durationSec
                        : 0,
                name: t.name,
                type: t.type,
                nrMessages: BigInt(countMap.get(t.id) ?? 0),
            }));

            // Try to get start time from messages
            let fileDate: Date | undefined;
            if (startTimeNs !== undefined) {
                // Timestamp is usually nanoseconds
                fileDate = new Date(Number(startTimeNs / 1_000_000n));
            }

            await this.finishExtraction(
                targetEntity,
                rawTopics,
                fileSize,
                fileDate,
                'db3_sqlite',
                startTime,
                actor,
            );
        } finally {
            database.close();
        }
    }
}

function toBigIntOrUndefined(
    value: string | null | undefined,
): bigint | undefined {
    if (!value) return undefined;
    return BigInt(value);
}

function getDurationSeconds(
    startTimeNs: bigint | undefined,
    endTimeNs: bigint | undefined,
): number {
    if (startTimeNs === undefined || endTimeNs === undefined) return 0;
    const durationNs = endTimeNs - startTimeNs;
    if (durationNs <= 0n) return 0;
    return Number(durationNs) / 1_000_000_000;
}
