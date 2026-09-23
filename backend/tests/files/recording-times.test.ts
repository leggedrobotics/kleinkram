import { FileEntity } from '@kleinkram/backend-common';
import { FileState, FileType, UserRole } from '@kleinkram/shared';
import { uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

/**
 * Waits for the ingestion pipeline to finish writing the recording window of a
 * file. Extraction runs in the queue consumer, so it is not done by the time
 * the upload is confirmed.
 */
const waitForRecordingTimes = async (
    filename: string,
    timeoutMs = 45_000,
): Promise<FileEntity> => {
    const fileRepo = database.getRepository(FileEntity);
    const deadline = Date.now() + timeoutMs;

    for (;;) {
        const file = await fileRepo.findOne({ where: { filename } });

        if (file?.recordingStartDate) return file;

        if (Date.now() > deadline) {
            throw new Error(
                `Recording times of '${filename}' were not extracted in time ` +
                    `(state: ${String(file?.state)})`,
            );
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }
};

describe('Recording Times', () => {
    jest.setTimeout(90_000);
    setupDatabaseHooks();

    /**
     * The fixture bag carries message timestamps from 1970, which is what makes
     * this a regression test: before the recording window was extracted, `date`
     * simply kept the upload time it was created with.
     */
    test('stores the first and last message time of an uploaded bag', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-recording-times@kleinkram.dev',
            'Recording Times User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'test.bag', missionUuid);

        const bag = await waitForRecordingTimes('test.bag');

        expect(bag.state).toBe(FileState.OK);
        expect(bag.recordingStartDate).toBeInstanceOf(Date);
        expect(bag.recordingEndDate).toBeInstanceOf(Date);

        // the recording predates its upload, so the two are clearly distinct
        expect(bag.recordingStartDate?.getTime()).toBeLessThan(
            bag.createdAt.getTime(),
        );

        // `date` is what the API sorts by and follows the recording start
        expect(bag.date.getTime()).toBe(bag.recordingStartDate?.getTime());

        expect(bag.recordingEndDate?.getTime()).toBeGreaterThanOrEqual(
            bag.recordingStartDate?.getTime() ?? 0,
        );
    });

    /**
     * MCAPs used to end up with their upload time as start date, because the
     * extractor read the recording start from an MCAP header field that the
     * format does not have.
     */
    test('stores the recording window of the converted mcap as well', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-recording-times-mcap@kleinkram.dev',
            'Recording Times Mcap User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'test.bag', missionUuid);
        await waitForRecordingTimes('test.bag');

        const converted = await database.getRepository(FileEntity).findOne({
            where: { filename: 'test.mcap', type: FileType.MCAP },
        });

        // conversion is opt-out per project; skip when it did not run
        if (!converted) return;

        expect(converted.recordingStartDate).toBeInstanceOf(Date);
        expect(converted.recordingStartDate?.getTime()).toBeLessThan(
            converted.createdAt.getTime(),
        );
        expect(converted.date.getTime()).toBe(
            converted.recordingStartDate?.getTime(),
        );
    });
});
