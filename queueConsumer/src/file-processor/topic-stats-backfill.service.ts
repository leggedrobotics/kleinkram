import { KEEP_UPDATED_AT } from '@kleinkram/backend-common/entities/base-entity.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { TOPIC_STATS_VERSION } from '@kleinkram/backend-common/services/topic-stats-backfill';
import { FileType } from '@kleinkram/shared';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import logger from '../logger';
import { McapMetadataService } from './handlers/mcap-metadata.service';
import { RosBagMetadataService } from './handlers/rosbag-metadata.service';
import { TopicStatsByName, topicStatsColumns } from './handlers/topic-stats';

const PRESIGNED_URL_TTL_SECONDS = 60 * 60;

/** What {@link TopicStatsBackfillService.backfillFile} did with a file. */
export type TopicStatsBackfillOutcome =
    /** The file was gone or already up to date. */
    | 'skipped'
    /** Statistics were read and written. */
    | 'updated'
    /**
     * Nothing to read (no topics, or a db3) or the index could not be read.
     * The file gets the version anyway and keeps its statistics null.
     */
    | 'marked';

/**
 * Computes the per-topic statistics (first and last seen, chunk count,
 * coverage, frequency) of files ingested before those were stored, from the
 * index of the file itself: the summary section of an MCAP, the chunk info
 * records of a ROS 1 bag.
 */
@Injectable()
export class TopicStatsBackfillService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepo: Repository<FileEntity>,
        @InjectRepository(TopicEntity)
        private readonly topicRepo: Repository<TopicEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly mcapMetadataService: McapMetadataService,
        private readonly rosBagMetadataService: RosBagMetadataService,
    ) {}

    /**
     * Brings the topic statistics of one file up to
     * {@link TOPIC_STATS_VERSION}. Running it twice on the same file is
     * harmless: the second run finds the file up to date, and even a
     * concurrent run only writes the same values again.
     */
    async backfillFile(fileUuid: string): Promise<TopicStatsBackfillOutcome> {
        const file = await this.fileRepo.findOne({
            select: { uuid: true, filename: true, type: true },
            where: {
                uuid: fileUuid,
                topicStatsVersion: LessThan(TOPIC_STATS_VERSION),
            },
        });
        if (!file) return 'skipped';

        const topics = await this.topicRepo.find({
            select: { uuid: true, name: true },
            where: { file: { uuid: file.uuid } },
        });

        // A bag converted to MCAP keeps its topics on the MCAP, and db3 has no
        // chunk index to read; neither needs the object.
        const stats =
            topics.length > 0 && file.type !== FileType.DB3
                ? await this.readTopicStats(file)
                : undefined;

        // Reading the object takes a while, so only the columns this job owns
        // are written, and `updatedAt` is left alone: the backfill derives
        // data the file always had, it does not edit it.
        await this.fileRepo.manager.transaction(async (manager) => {
            if (stats) {
                for (const topic of topics) {
                    const topicStats = stats.get(topic.name);
                    await manager.update(
                        TopicEntity,
                        { uuid: topic.uuid },
                        {
                            ...topicStatsColumns(topicStats),
                            ...(topicStats?.frequency === undefined
                                ? {}
                                : { frequency: topicStats.frequency }),
                            ...KEEP_UPDATED_AT,
                        },
                    );
                }
            }
            await manager.update(
                FileEntity,
                {
                    uuid: file.uuid,
                    topicStatsVersion: LessThan(TOPIC_STATS_VERSION),
                },
                { topicStatsVersion: TOPIC_STATS_VERSION, ...KEEP_UPDATED_AT },
            );
        });

        return stats ? 'updated' : 'marked';
    }

    /**
     * Undefined when the file's index cannot be read. An index that says too
     * little (chunks without a message index) yields an empty map instead,
     * which clears the statistics of every topic.
     */
    private async readTopicStats(
        file: FileEntity,
    ): Promise<TopicStatsByName | undefined> {
        try {
            switch (file.type) {
                case FileType.MCAP: {
                    return await this.mcapMetadataService.probeTopicStatsFromUrl(
                        await this.presignedUrl(file),
                    );
                }
                case FileType.BAG: {
                    return await this.rosBagMetadataService.probeTopicStatsFromUrl(
                        await this.presignedUrl(file),
                    );
                }
                default: {
                    return undefined;
                }
            }
        } catch (error: unknown) {
            logger.warn(
                `[TopicStatsBackfill] Could not read the index of ${file.filename} (${file.uuid}), leaving its topic stats empty: ${String(error)}`,
            );
            return undefined;
        }
    }

    private async presignedUrl(file: FileEntity): Promise<string> {
        return this.dataStorage.getInternalPresignedDownloadUrl(
            file.uuid,
            PRESIGNED_URL_TTL_SECONDS,
        );
    }
}
