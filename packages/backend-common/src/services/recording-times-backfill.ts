import { FileState, FileType } from '@kleinkram/shared';
import { In, IsNull, Repository } from 'typeorm';
import { FileEntity } from '../entities/file/file.entity';

/**
 * Name of the `file-queue` job that recovers the recording window of a single
 * already ingested file.
 */
export const RECORDING_TIMES_BACKFILL_JOB = 'extractRecordingTimesFromS3';

/**
 * Options every enqueue of {@link RECORDING_TIMES_BACKFILL_JOB} uses.
 *
 * The job id makes a re-run skip files that are still queued from an earlier
 * one, and dropping finished jobs keeps that id available for the next time
 * the file needs to be looked at.
 */
export const recordingTimesBackfillJobOptions = (
    fileUuid: string,
): { jobId: string; removeOnComplete: boolean; removeOnFail: boolean } => ({
    jobId: `recording-times:${fileUuid}`,
    removeOnComplete: true,
    removeOnFail: true,
});

/**
 * File types that carry timestamped messages, and are therefore the only ones
 * a recording window can be recovered from.
 */
export const RECORDING_FILE_TYPES = [FileType.BAG, FileType.MCAP, FileType.DB3];

/**
 * Selects the files that could still have a recording window but do not know
 * it yet: everything ingested before `recordingStartDate` existed, plus every
 * MCAP written while the extractor looked for the recording start in an MCAP
 * header field that does not exist.
 *
 * Newest first, so that a partial run fixes what users are most likely to look
 * at next.
 */
export const findFilesMissingRecordingTimes = async (
    fileRepository: Repository<FileEntity>,
    limit: number,
): Promise<FileEntity[]> =>
    fileRepository.find({
        select: { uuid: true },
        where: {
            recordingStartDate: IsNull(),
            state: FileState.OK,
            type: In(RECORDING_FILE_TYPES),
        },
        order: { createdAt: 'DESC' },
        take: limit,
    });
