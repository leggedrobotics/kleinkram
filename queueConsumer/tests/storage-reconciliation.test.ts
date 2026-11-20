import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState } from '@kleinkram/shared';
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

const fakeFile = (
    uuid: string,
    overrides: Partial<FakeFile> = {},
): FakeFile => ({
    uuid,
    filename: `${uuid}.bag`,
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
): IStorageBucket & { written: string[] } => {
    const written: string[] = [];
    return {
        written,
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
            moved: { ...tagsOf(moved), missionUuid: 'mission-a' },
            current: tagsOf(current),
        });

        const result = await reconcileStorage(
            storage,
            fakeRepository([moved, current]),
            log,
        );

        expect(storage.written).toEqual(['moved']);
        expect(result).toMatchObject({ objectsChecked: 2, tagsRepaired: 1 });
    });

    test('should mark a file LOST if its object is missing', async () => {
        const present = fakeFile('present');
        const missing = fakeFile('missing');
        const files = [present, missing];

        const result = await reconcileStorage(
            fakeStorage({ present: tagsOf(present) }),
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
        const storage = fakeStorage({ orphan: {} });

        const result = await reconcileStorage(storage, fakeRepository([]), log);

        expect(result.objectsWithoutFile).toBe(1);
        expect(storage.written).toEqual([]);
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
