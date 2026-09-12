import { FileState, FileType } from '@kleinkram/shared';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { FileEntity } from '../entities/file/file.entity';

/**
 * Name of the `file-queue` job that recovers the recording window of a single
 * already ingested file.
 */
export const RECORDING_TIMES_BACKFILL_JOB = 'extractRecordingTimesFromS3';

/**
 * How long a file that we could not read a recording window from is left alone
 * before it is looked at again. Long enough that a permanently unreadable file
 * costs close to nothing, short enough that one which only becomes readable
 * later (a restored object, say) is still picked up.
 */
export const RECORDING_TIMES_RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

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
 * Least recently looked at first, never looked at before that. A file we fail
 * to read therefore moves to the back of the queue instead of being retried
 * ahead of files that have not had a turn at all, which is what lets a run of
 * unreadable files (an empty recording has no window to find) be worked past
 * rather than blocking the backlog behind it.
 */
export const findFilesMissingRecordingTimes = async (
    fileRepository: Repository<FileEntity>,
    limit: number,
    now = new Date(),
): Promise<FileEntity[]> => {
    const retryBefore = new Date(
        now.getTime() - RECORDING_TIMES_RETRY_AFTER_MS,
    );

    const eligible = {
        recordingStartDate: IsNull(),
        state: FileState.OK,
        type: In(RECORDING_FILE_TYPES),
    };

    return fileRepository.find({
        select: { uuid: true },
        where: [
            { ...eligible, recordingTimesCheckedAt: IsNull() },
            { ...eligible, recordingTimesCheckedAt: LessThan(retryBefore) },
        ],
        order: {
            recordingTimesCheckedAt: { direction: 'ASC', nulls: 'FIRST' },
        },
        take: limit,
    });
};
