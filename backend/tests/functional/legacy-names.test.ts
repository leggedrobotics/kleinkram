import {
    FileEntity,
    IngestionJobEntity,
    ProjectEntity,
} from '@kleinkram/backend-common';
import { QueueState, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { HeaderCreator, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

/**
 * Waits until the queue consumer has finished processing an upload. It
 * writes the recording time into the file's `date`, so a date set before it
 * finishes is overwritten.
 */
const waitForProcessing = async (fileUuid: string): Promise<void> => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const job = await database
            .getRepository(IngestionJobEntity)
            .findOneBy({ identifier: fileUuid });
        if (job && job.state >= QueueState.COMPLETED) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Processing of file ${fileUuid} didn't finish`);
};

const put = async (
    headers: HeaderCreator,
    path: string,
    body: Record<string, unknown>,
): Promise<{ status: number; message: string }> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method: 'PUT',
        headers: headers.getHeaders(),
        body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
        message?: string | string[];
    };
    const message = Array.isArray(json.message)
        ? json.message.join('; ')
        : (json.message ?? '');
    return { status: response.status, message };
};

/**
 * Projects and files named before the naming rules
 * (`packages/validation/src/name.validation.ts`, `filename.validation.ts`)
 * can still be edited without renaming them; a changed name must follow the
 * rules.
 */
describe('Names from before the naming rules', () => {
    setupDatabaseHooks();

    test('should keep an unchanged project name and check a changed one', async () => {
        const { user, projectUuid } = await setupTestEnvironment(
            'legacy-project-name@leggedrobotics.com',
            'Legacy Names',
            UserRole.ADMIN,
        );
        await database
            .getRepository(ProjectEntity)
            .update({ uuid: projectUuid }, { name: '-legacy project' });

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');

        const unchanged = await put(headers, `/projects/${projectUuid}`, {
            name: '-legacy project',
            description: 'new description',
        });
        expect(unchanged.status).toBe(200);
        const project = await database
            .getRepository(ProjectEntity)
            .findOneByOrFail({ uuid: projectUuid });
        expect(project.description).toBe('new description');

        const renamedInvalid = await put(headers, `/projects/${projectUuid}`, {
            name: '-other project',
            description: 'new description',
        });
        expect(renamedInvalid.status).toBe(400);
        expect(renamedInvalid.message).toBe(
            "Project name may only contain letters, digits, '.', '-' and '_' (found space). Try \"other-project\".",
        );

        const renamedValid = await put(headers, `/projects/${projectUuid}`, {
            name: 'other-project',
            description: 'new description',
        });
        expect(renamedValid.status).toBe(200);
    }, 30_000);

    test('should keep an unchanged file name and check a changed one', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'legacy-file-name@leggedrobotics.com',
            'Legacy Names',
            UserRole.ADMIN,
        );
        await uploadFile(user, 'test.bag', missionUuid);
        const fileRepository = database.getRepository(FileEntity);
        const file = await fileRepository.findOneByOrFail({
            filename: 'test.bag',
        });
        await waitForProcessing(file.uuid);
        await fileRepository.update(
            { uuid: file.uuid },
            { filename: 'log(1).bag' },
        );

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');
        const newDate = new Date('2024-05-14T00:00:00Z');

        const unchanged = await put(headers, `/files/${file.uuid}`, {
            uuid: file.uuid,
            filename: 'log(1).bag',
            date: newDate,
        });
        expect(unchanged.status).toBe(200);
        const updated = await fileRepository.findOneByOrFail({
            uuid: file.uuid,
        });
        expect(updated.date.toISOString()).toBe(newDate.toISOString());

        const renamedInvalid = await put(headers, `/files/${file.uuid}`, {
            uuid: file.uuid,
            filename: 'log(2).bag',
            date: newDate,
        });
        expect(renamedInvalid.status).toBe(400);
        expect(renamedInvalid.message).toBe(
            "File name may only contain letters, digits, '.', '-' and '_' (found '(', ')'). Try \"log-2.bag\".",
        );

        const renamedValid = await put(headers, `/files/${file.uuid}`, {
            uuid: file.uuid,
            filename: 'log_1.bag',
            date: newDate,
        });
        expect(renamedValid.status).toBe(200);
    }, 120_000); // processing the upload alone may take up to a minute
});
