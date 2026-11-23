import { FileState } from '@kleinkram/shared';
import { In, LessThan, Repository } from 'typeorm';
import { FileEntity } from '../entities/file/file.entity';
import { RECORDING_FILE_TYPES } from './recording-times-backfill';

/**
 * Version of the per-topic statistics stored on `TopicEntity` (`firstSeen`,
 * `lastSeen`, `chunkCount`, `coverage` and `frequency`).
 *
 * Ingestion stamps every file it processes with this version, and the
 * backfill recomputes every file below it. Raise it whenever the computation
 * changes, and the backfill brings every existing file up to date.
 */
export const TOPIC_STATS_VERSION = 1;

/**
 * Name of the `file-queue` job that recomputes the topic statistics of a
 * single already ingested file.
 */
export const TOPIC_STATS_BACKFILL_JOB = 'backfillTopicStats';

/**
 * Options every enqueue of {@link TOPIC_STATS_BACKFILL_JOB} uses.
 *
 * The job id makes a re-run skip files that are still queued from an earlier
 * one, and dropping finished jobs keeps that id available for a later
 * version.
 */
export const topicStatsBackfillJobOptions = (
    fileUuid: string,
): { jobId: string; removeOnComplete: boolean; removeOnFail: boolean } => ({
    jobId: `topic-stats:${fileUuid}`,
    removeOnComplete: true,
    removeOnFail: true,
});

/**
 * Selects files whose topic statistics are older than
 * {@link TOPIC_STATS_VERSION}: healthy, not deleted, and of a type that has
 * topics.
 *
 * A file leaves the selection as soon as it has been looked at, whether or not
 * its index could be read, so there is no retry rotation to manage. Newest
 * first, since those are the files people are most likely to open.
 */
export const findFilesNeedingTopicStats = async (
    fileRepository: Repository<FileEntity>,
    limit: number,
): Promise<FileEntity[]> =>
    fileRepository.find({
        select: { uuid: true },
        where: {
            state: FileState.OK,
            type: In(RECORDING_FILE_TYPES),
            topicStatsVersion: LessThan(TOPIC_STATS_VERSION),
        },
        order: { createdAt: 'DESC' },
        take: limit,
    });
