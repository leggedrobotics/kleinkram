import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import {
    findFilesNeedingTopicStats,
    TOPIC_STATS_VERSION,
    topicStatsBackfillJobOptions,
} from '@kleinkram/backend-common/services/topic-stats-backfill';
import { FileState, FileType } from '@kleinkram/shared';
import { FindManyOptions, FindOperator, Repository } from 'typeorm';

/** Captures what the selection asks the database for. */
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

describe('findFilesNeedingTopicStats', () => {
    test('should only select healthy files that can have topics', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesNeedingTopicStats(repository, 10);

        const where = options().where as Record<string, unknown>;
        expect(where.state).toBe(FileState.OK);
        expect(where.type).toEqual(
            expect.objectContaining({
                value: [FileType.BAG, FileType.MCAP, FileType.DB3],
            }),
        );
    });

    test('should select files below the current version', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesNeedingTopicStats(repository, 10);

        const where = options().where as Record<string, unknown>;
        const version = where.topicStatsVersion as FindOperator<number>;
        expect(version.type).toBe('lessThan');
        expect(version.value).toBe(TOPIC_STATS_VERSION);
    });

    test('should leave soft-deleted files out', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesNeedingTopicStats(repository, 10);

        // TypeORM skips rows with `deletedAt` set unless asked otherwise.
        expect(options().withDeleted).toBeUndefined();
    });

    test('should take at most the batch size', async () => {
        const { repository, options } = captureFindOptions();
        await findFilesNeedingTopicStats(repository, 1000);

        expect(options().take).toBe(1000);
        expect(options().select).toEqual({ uuid: true });
    });
});

describe('topicStatsBackfillJobOptions', () => {
    test('should give one job id per file, so a file is queued only once', () => {
        expect(topicStatsBackfillJobOptions('abc').jobId).toBe(
            'topic-stats:abc',
        );
        expect(topicStatsBackfillJobOptions('abc')).toEqual(
            topicStatsBackfillJobOptions('abc'),
        );
    });
});
