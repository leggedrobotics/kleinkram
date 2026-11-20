import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { toObjectTagValue } from '@kleinkram/backend-common/modules/storage/object-tags';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState } from '@kleinkram/shared';
import { In, LessThan, Repository } from 'typeorm';

/**
 * The database is the source of truth for a file's project, mission and
 * name. The storage keeps a copy as object tags, written best effort after
 * each change (a failed write must not fail a change that was saved), so the
 * copy can drift. This job compares both sides and repairs the copy.
 */

/** File states whose object must exist in the bucket. */
const STATES_WITH_OBJECT = [FileState.OK, FileState.FOUND];

/**
 * Files created this recently are left alone when looking for lost objects:
 * an upload can finish between listing the bucket and reading the database.
 */
const LOST_GRACE_PERIOD_MS = 60 * 60 * 1000;

/** Objects whose tags are read and written at the same time. */
const CONCURRENCY = 10;

/** File objects are named by their file's uuid. */
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Objects looked up in the database per query. */
const BATCH_SIZE = 500;

/**
 * If more files than this look lost, the listing is more likely wrong than
 * the data (e.g. a storage outage or a misconfigured bucket): nothing is
 * marked and the run is reported instead.
 */
const MAX_LOST_SHARE = 0.05;
const MAX_LOST_WITHOUT_CHECK = 20;

/**
 * Whether the number of files that look lost is plausible enough to mark
 * them, see `MAX_LOST_SHARE`.
 */
export const isPlausibleLoss = (lost: number, expected: number): boolean =>
    lost <= MAX_LOST_WITHOUT_CHECK || lost <= expected * MAX_LOST_SHARE;

export interface ReconciliationResult {
    objectsChecked: number;
    tagsRepaired: number;
    tagRepairsFailed: number;
    /** Objects without a file in the database. Logged, never deleted. */
    objectsWithoutFile: number;
    /** Files marked LOST because their object is missing. */
    filesMarkedLost: number;
    /** Files that look lost but weren't marked, see `isPlausibleLoss`. */
    lostCheckSkipped: number;
    /** Files whose object couldn't be checked again; left unchanged. */
    lostChecksFailed: number;
}

/** The tags an object should carry, as `addTags` writes them. */
export const expectedTags = (file: {
    filename: string;
    mission?: { uuid: string; project?: { uuid: string } };
}): Record<string, string> | undefined => {
    const projectUuid = file.mission?.project?.uuid;
    const missionUuid = file.mission?.uuid;
    if (!projectUuid || !missionUuid) return undefined;
    return {
        projectUuid,
        missionUuid,
        filename: file.filename,
    };
};

/**
 * Whether the stored tags differ from the expected ones. Values are compared
 * the way they are stored: `addTags` replaces characters S3 doesn't allow
 * and shortens long values.
 */
export const tagsDiffer = (
    actual: Record<string, string>,
    expected: Record<string, string>,
): boolean =>
    Object.entries(expected).some(
        ([key, value]) => actual[key] !== toObjectTagValue(value),
    );

/** Runs `task` for every item, at most `limit` at a time. */
const forEachLimited = async <T>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<void>,
): Promise<void> => {
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const item = items[next++] as T;
            await task(item);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker),
    );
};

/**
 * Compares the bucket with the database and repairs the difference:
 *
 * - objects whose tags don't match their file get the right tags
 * - files that should have an object but don't are marked LOST
 * - objects without a file are only counted: deleting data is left to a
 *   person
 */
export const reconcileStorage = async (
    dataStorage: IStorageBucket,
    fileRepository: Repository<FileEntity>,
    log: { warn: (message: string) => void },
): Promise<ReconciliationResult> => {
    const listedAt = new Date();
    const objects = await dataStorage.listFiles();
    const objectNames = new Set(objects.map((object) => object.name));

    const result: ReconciliationResult = {
        objectsChecked: 0,
        tagsRepaired: 0,
        tagRepairsFailed: 0,
        objectsWithoutFile: 0,
        filesMarkedLost: 0,
        lostCheckSkipped: 0,
        lostChecksFailed: 0,
    };

    // Keys that aren't uuids (a test object, a folder marker) can't belong
    // to a file, and Postgres would reject the whole query with them.
    const names = [...objectNames].filter((name) => UUID.test(name));
    result.objectsWithoutFile += objectNames.size - names.length;
    for (let start = 0; start < names.length; start += BATCH_SIZE) {
        const batch = names.slice(start, start + BATCH_SIZE);
        const files = await fileRepository.find({
            where: { uuid: In(batch) },
            relations: { mission: { project: true } },
            select: {
                uuid: true,
                filename: true,
                mission: { uuid: true, project: { uuid: true } },
            },
        });
        const filesByUuid = new Map(files.map((file) => [file.uuid, file]));
        result.objectsWithoutFile += batch.filter(
            (name) => !filesByUuid.has(name),
        ).length;

        await forEachLimited(files, CONCURRENCY, async (file) => {
            const expected = expectedTags(file);
            if (!expected) return;
            result.objectsChecked++;
            try {
                const actual = await dataStorage.getTags(file.uuid);
                if (!tagsDiffer(actual, expected)) return;
                await dataStorage.addTags(file.uuid, expected);
                result.tagsRepaired++;
            } catch (error: unknown) {
                result.tagRepairsFailed++;
                log.warn(
                    `Repairing the storage tags of file ${file.uuid} failed: ${String(error)}`,
                );
            }
        });
    }

    // Only files older than the listing (minus a grace period) count: a
    // newer upload may simply not have been in the listing yet.
    const filesThatNeedAnObject = await fileRepository.find({
        where: {
            state: In(STATES_WITH_OBJECT),
            createdAt: LessThan(
                new Date(listedAt.getTime() - LOST_GRACE_PERIOD_MS),
            ),
        },
        select: { uuid: true },
    });
    const candidates = filesThatNeedAnObject
        .map((file) => file.uuid)
        .filter((uuid) => !objectNames.has(uuid));
    if (!isPlausibleLoss(candidates.length, filesThatNeedAnObject.length)) {
        result.lostCheckSkipped = candidates.length;
        return result;
    }

    // The listing is a snapshot: an upload reserved long ago can finish
    // after it was taken. Ask the storage once more before marking a file.
    const lost: string[] = [];
    await forEachLimited(candidates, CONCURRENCY, async (uuid) => {
        try {
            if ((await dataStorage.getFileInfo(uuid)) === undefined) {
                lost.push(uuid);
            }
        } catch (error: unknown) {
            // not checked, so not marked: reported instead of looking clean
            result.lostChecksFailed++;
            log.warn(
                `Checking whether file ${uuid} is missing from the storage failed: ${String(error)}`,
            );
        }
    });
    for (let start = 0; start < lost.length; start += BATCH_SIZE) {
        const update = await fileRepository.update(
            {
                uuid: In(lost.slice(start, start + BATCH_SIZE)),
                state: In(STATES_WITH_OBJECT),
            },
            {
                state: FileState.LOST,
                stateComment:
                    'The file is missing from the storage (found by the nightly storage check)',
            },
        );
        result.filesMarkedLost += update.affected ?? 0;
    }

    return result;
};
