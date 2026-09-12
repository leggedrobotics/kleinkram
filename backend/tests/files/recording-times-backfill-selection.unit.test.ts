import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import {
    findFilesMissingRecordingTimes,
    RECORDING_TIMES_RETRY_AFTER_MS,
} from '@kleinkram/backend-common/services/recording-times-backfill';
import { FileState, FileType } from '@kleinkram/shared';
import { FindManyOptions, Repository } from 'typeorm';

/**
 * Captures what the selection asks the database for. The interesting part is
 * the ordering and the retry window, neither of which a repository mock can
 * fake away.
 */
const captureFindOptions = (): {
    repository: Repository<FileEntity>;
    options: () => FindManyOptions<FileEntity>;
} => {
    let captured: FindManyOptions<FileEntity> | undefined;

    const repository = {
        find: (findOptions: FindManyOptions<FileEntity>) => {
            captured = findOptions;
            return Promise.resolve([]);
        },
    } as unknown as Repository<FileEntity>;

    return {
        repository,
        options: () => {
            if (!captured) throw new Error('find() was never called');
            return captured;
        },
    };
};

describe('findFilesMissingRecordingTimes', () => {
    const now = new Date('2026-09-12T12:00:00.000Z');

    test('only considers healthy files that can hold a recording', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesMissingRecordingTimes(repository, 10, now);

        const where = options().where as Record<string, unknown>[];

        for (const branch of where) {
            expect(branch.state).toBe(FileState.OK);
            expect(branch.recordingStartDate).toBeDefined();
            expect(branch.type).toEqual(
                expect.objectContaining({
                    value: [FileType.BAG, FileType.MCAP, FileType.DB3],
                }),
            );
        }
    });

    /**
     * Without this, a batch of files we cannot read a window from (an empty
     * recording has none) would be selected again on every run and the files
     * behind them would never get a turn.
     */
    test('takes never-checked files before recently checked ones', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesMissingRecordingTimes(repository, 10, now);

        expect(options().order).toEqual({
            recordingTimesCheckedAt: { direction: 'ASC', nulls: 'FIRST' },
        });
    });

    test('retries a file we failed to read only after the retry window', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesMissingRecordingTimes(repository, 10, now);

        const where = options().where as Record<string, unknown>[];
        expect(where).toHaveLength(2);

        const retryBranch = where.find(
            (branch) =>
                (
                    branch.recordingTimesCheckedAt as
                        { type?: string } | undefined
                )?.type === 'lessThan',
        );

        expect(retryBranch?.recordingTimesCheckedAt).toEqual(
            expect.objectContaining({
                value: new Date(now.getTime() - RECORDING_TIMES_RETRY_AFTER_MS),
            }),
        );
    });

    test('passes the batch size on as the limit', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesMissingRecordingTimes(repository, 250, now);

        expect(options().take).toBe(250);
    });
});
