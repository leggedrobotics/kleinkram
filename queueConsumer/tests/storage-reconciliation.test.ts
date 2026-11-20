import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState } from '@kleinkram/shared';
import { randomUUID } from 'node:crypto';
import { FindOperator, Repository } from 'typeorm';
import {
    expectedTags,
    isPlausibleLoss,
    reconcileStorage,
    tagsDiffer,
} from '../src/fileCleanup/storage-reconciliation';

interface FakeFile {
    uuid: string;
    filename: string;
    state: FileState;
    createdAt: Date;
    missionUuid: string;
    projectUuid: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** A stable uuid per readable test name: objects are named by uuid. */
const ids = new Map<string, string>();
const id = (name: string): string => {
    const existing = ids.get(name);
    if (existing) return existing;
    const created = randomUUID();
    ids.set(name, created);
    return created;
};

const fakeFile = (
    name: string,
    overrides: Partial<FakeFile> = {},
): FakeFile => ({
    uuid: id(name),
    filename: `${name}.bag`,
    state: FileState.OK,
    createdAt: new Date(Date.now() - DAY),
    missionUuid: 'mission-a',
    projectUuid: 'project-a',
    ...overrides,
});

const matches = (value: unknown, condition: unknown): boolean => {
    if (!(condition instanceof FindOperator)) return value === condition;
    const operand = condition.value as unknown;
    if (condition.type === 'in') return (operand as unknown[]).includes(value);
    if (condition.type === 'lessThan') {
        return (value as Date).getTime() < (operand as Date).getTime();
    }
    throw new Error(`unsupported operator ${condition.type}`);
};

/** The two repository calls the job makes, on an in-memory table. */
const fakeRepository = (files: FakeFile[]): Repository<FileEntity> => {
    const select = (where: Record<string, unknown>): FakeFile[] =>
        files.filter((file) =>
            Object.entries(where).every(([key, condition]) =>
                matches(file[key as keyof FakeFile], condition),
            ),
        );
    return {
        find: ({ where }: { where: Record<string, unknown> }) =>
            Promise.resolve(
                select(where).map((file) => ({
                    uuid: file.uuid,
                    filename: file.filename,
                    mission: {
                        uuid: file.missionUuid,
                        project: { uuid: file.projectUuid },
                    },
                })),
            ),
        update: (
            where: Record<string, unknown>,
            changes: Partial<FakeFile>,
        ) => {
            const affected = select(where);
            for (const file of affected) Object.assign(file, changes);
            return Promise.resolve({ affected: affected.length });
        },
    } as unknown as Repository<FileEntity>;
};

const fakeStorage = (
    tagsByObject: Record<string, Record<string, string>>,
    /** objects that arrive after the listing was taken */
    lateObjects: string[] = [],
): IStorageBucket & { written: string[] } => {
    const written: string[] = [];
    return {
        written,
        getFileInfo: (name: string) =>
            Promise.resolve(
                name in tagsByObject || lateObjects.includes(name)
                    ? {
                          size: 1,
                          etag: '',
                          lastModified: new Date(),
                          metaData: {},
                      }
                    : undefined,
            ),
        listFiles: () =>
            Promise.resolve(
                Object.keys(tagsByObject).map((name) => ({
                    name,
                    lastModified: new Date(),
                    etag: '',
                    size: 1,
                })),
            ),
        getTags: (name: string) => Promise.resolve(tagsByObject[name] ?? {}),
        addTags: (name: string, tags: Record<string, string>) => {
            written.push(name);
            tagsByObject[name] = tags;
            return Promise.resolve();
        },
    } as unknown as IStorageBucket & { written: string[] };
};

const tagsOf = (file: FakeFile): Record<string, string> => ({
    projectUuid: file.projectUuid,
    missionUuid: file.missionUuid,
    filename: file.filename,
});

const log = { warn: jest.fn() };

describe('Storage Reconciliation', () => {
    test('should rewrite only the tags that drifted from the database', async () => {
        const moved = fakeFile('moved', { missionUuid: 'mission-b' });
        const current = fakeFile('current');
        const storage = fakeStorage({
            [moved.uuid]: { ...tagsOf(moved), missionUuid: 'mission-a' },
            [current.uuid]: tagsOf(current),
        });

        const result = await reconcileStorage(
            storage,
            fakeRepository([moved, current]),
            log,
        );

        expect(storage.written).toEqual([moved.uuid]);
        expect(result).toMatchObject({ objectsChecked: 2, tagsRepaired: 1 });
    });

    test('should mark a file LOST if its object is missing', async () => {
        const present = fakeFile('present');
        const missing = fakeFile('missing');
        const files = [present, missing];

        const result = await reconcileStorage(
            fakeStorage({ [present.uuid]: tagsOf(present) }),
            fakeRepository(files),
            log,
        );

        expect(result.filesMarkedLost).toBe(1);
        expect(missing.state).toBe(FileState.LOST);
        expect(present.state).toBe(FileState.OK);
    });

    test('should not mark new or unfinished uploads LOST', async () => {
        const justUploaded = fakeFile('just-uploaded', {
            createdAt: new Date(),
        });
        const uploading = fakeFile('uploading', {
            state: FileState.UPLOADING,
        });

        const result = await reconcileStorage(
            fakeStorage({}),
            fakeRepository([justUploaded, uploading]),
            log,
        );

        expect(result.filesMarkedLost).toBe(0);
        expect(justUploaded.state).toBe(FileState.OK);
        expect(uploading.state).toBe(FileState.UPLOADING);
    });

    test('should mark nothing if implausibly many files look lost', async () => {
        const files = Array.from({ length: 100 }, (_, index) =>
            fakeFile(`file-${index.toString()}`),
        );

        const result = await reconcileStorage(
            fakeStorage({}),
            fakeRepository(files),
            log,
        );

        expect(result.lostCheckSkipped).toBe(100);
        expect(result.filesMarkedLost).toBe(0);
        expect(files.every((file) => file.state === FileState.OK)).toBe(true);
    });

    test('should count objects without a file and leave them alone', async () => {
        const storage = fakeStorage({ [id('orphan')]: {} });

        const result = await reconcileStorage(storage, fakeRepository([]), log);

        expect(result.objectsWithoutFile).toBe(1);
        expect(storage.written).toEqual([]);
    });

    test('should not mark a file LOST whose upload finished after the listing', async () => {
        const late = fakeFile('late');

        const result = await reconcileStorage(
            fakeStorage({}, [late.uuid]),
            fakeRepository([late]),
            log,
        );

        expect(result.filesMarkedLost).toBe(0);
        expect(late.state).toBe(FileState.OK);
    });

    test('should report a failed check instead of marking the file', async () => {
        const unreachable = fakeFile('unreachable');
        const storage = fakeStorage({});
        jest.spyOn(storage, 'getFileInfo').mockRejectedValue(
            new Error('timeout'),
        );

        const result = await reconcileStorage(
            storage,
            fakeRepository([unreachable]),
            log,
        );

        expect(result.lostChecksFailed).toBe(1);
        expect(result.filesMarkedLost).toBe(0);
        expect(unreachable.state).toBe(FileState.OK);
    });

    test('should skip keys that are not file uuids', async () => {
        const file = fakeFile('kept');
        const repository = fakeRepository([file]);
        const find = jest.spyOn(repository, 'find');

        const result = await reconcileStorage(
            fakeStorage({
                'test/': {},
                'notes.txt': {},
                [file.uuid]: tagsOf(file),
            }),
            repository,
            log,
        );

        expect(result.objectsWithoutFile).toBe(2);
        expect(result.objectsChecked).toBe(1);
        const queried = (
            find.mock.calls[0]?.[0] as unknown as {
                where: { uuid: FindOperator<string[]> };
            }
        ).where.uuid.value;
        expect(queried).toEqual([file.uuid]);
    });

    test('should compare tag values the way they are stored', () => {
        const expected = expectedTags({
            filename: 'run (left).bag',
            mission: { uuid: 'm', project: { uuid: 'p' } },
        });
        expect(expected).toBeDefined();

        // parentheses aren't allowed in S3 tag values and are stored as `_`
        expect(
            tagsDiffer(
                {
                    projectUuid: 'p',
                    missionUuid: 'm',
                    filename: 'run _left_.bag',
                },
                expected ?? {},
            ),
        ).toBe(false);
    });

    test.each([
        [20, 20, true],
        [21, 100, false],
        [5, 100, true],
        [500, 10_000, true],
    ])(
        'should treat %i lost of %i files as plausible: %s',
        (lost, expected, plausible) => {
            expect(isPlausibleLoss(lost, expected)).toBe(plausible);
        },
    );
});
