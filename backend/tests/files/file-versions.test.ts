import type { FileEventsDto } from '@kleinkram/api-dto';
import { FileEntity, FileVersionEntity } from '@kleinkram/backend-common';
import { FileEventType, FileState } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { getAuthHeaders, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

/**
 * Uploading the same filename twice replaces the file by default; with
 * `newVersion` it is kept as a new version of the existing file instead, and
 * both versions stay individually downloadable.
 */
const getFile = async (): Promise<FileEntity> =>
    database.getRepository(FileEntity).findOneOrFail({
        where: { filename: 'test.bag' },
        relations: { versions: true },
    });

describe('File versions', () => {
    jest.setTimeout(120_000);
    setupDatabaseHooks();

    test('a second upload of the same name is rejected without newVersion', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'file-versions-conflict@kleinkram.dev',
            'File Versions Conflict User',
        );

        await uploadFile(user, 'test.bag', missionUuid);

        const response = await fetch(`${DEFAULT_URL}/files/temporaryAccess`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(user),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filenames: ['test.bag'],
                missionUUID: missionUuid,
            }),
        });

        expect(response.status).toBe(409);
    });

    test('newVersion adds a version, keeps the old one and records an event', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'file-versions@kleinkram.dev',
            'File Versions User',
        );

        await uploadFile(user, 'test.bag', missionUuid);

        const afterFirstUpload = await getFile();
        expect(afterFirstUpload.versions).toHaveLength(1);
        const firstVersionUuid = afterFirstUpload.activeVersionUuid;

        await uploadFile(user, 'test.bag', missionUuid, {
            newVersion: true,
            fixture: 'file2.bag',
        });

        const afterSecondUpload = await getFile();
        expect(afterSecondUpload.versions).toHaveLength(2);
        expect(afterSecondUpload.activeVersionUuid).not.toBe(firstVersionUuid);
        expect(afterSecondUpload.activeVersion?.versionNumber).toBe(2);

        // the superseded version is untouched, not overwritten
        const firstVersion = await database
            .getRepository(FileVersionEntity)
            .findOneOrFail({ where: { uuid: firstVersionUuid ?? '' } });
        expect(firstVersion.versionNumber).toBe(1);
        expect(firstVersion.state).toBe(FileState.OK);

        const eventsResponse = await fetch(
            `${DEFAULT_URL}/files/${afterSecondUpload.uuid}/events`,
            { method: 'GET', headers: getAuthHeaders(user) },
        );
        expect(eventsResponse.status).toBe(200);

        const events = (await eventsResponse.json()) as FileEventsDto;
        const versionEvent = events.data.find(
            (event) => event.type === FileEventType.VERSION_UPLOADED,
        );
        expect(versionEvent).toBeDefined();
        expect(versionEvent?.details.versionNumber).toBe(2);
    });

    test('an older version can be downloaded by uuid', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'file-versions-download@kleinkram.dev',
            'File Versions Download User',
        );

        await uploadFile(user, 'test.bag', missionUuid);
        const firstUpload = await getFile();
        const firstVersionUuid = firstUpload.activeVersionUuid;

        await uploadFile(user, 'test.bag', missionUuid, {
            newVersion: true,
            fixture: 'file2.bag',
        });
        const file = await getFile();

        const download = async (versionUuid?: string): Promise<string> => {
            const query = new URLSearchParams({
                expires: 'true',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                preview_only: 'false',
                ...(versionUuid ? { versionUuid } : {}),
            });
            const response = await fetch(
                `${DEFAULT_URL}/files/${file.uuid}/download?${query.toString()}`,
                { method: 'GET', headers: getAuthHeaders(user) },
            );
            expect(response.status).toBe(200);
            const json = (await response.json()) as { url: string };
            return json.url;
        };

        const activeUrl = await download();
        const oldUrl = await download(firstVersionUuid ?? '');

        // the two versions are addressed as two distinct storage objects
        expect(activeUrl).toContain(file.activeVersionUuid ?? '');
        expect(oldUrl).toContain(firstVersionUuid ?? '');
        expect(activeUrl).not.toContain(firstVersionUuid ?? '');

        // and both of them are really there, not just addressable
        for (const url of [activeUrl, oldUrl]) {
            const stored = await fetch(url);
            expect(stored.status).toBe(200);
            const bytes = await stored.arrayBuffer();
            expect(bytes.byteLength).toBeGreaterThan(0);
        }
    });

    test('a version of another file cannot be downloaded through this file', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'file-versions-scope@kleinkram.dev',
            'File Versions Scope User',
        );

        await uploadFile(user, 'test.bag', missionUuid);
        await uploadFile(user, 'file1.bag', missionUuid);

        const files = database.getRepository(FileEntity);
        const target = await files.findOneOrFail({
            where: { filename: 'test.bag' },
        });
        const other = await files.findOneOrFail({
            where: { filename: 'file1.bag' },
        });

        const response = await fetch(
            `${DEFAULT_URL}/files/${target.uuid}/download` +
                `?expires=true&preview_only=false&versionUuid=${other.activeVersionUuid ?? ''}`,
            { method: 'GET', headers: getAuthHeaders(user) },
        );

        expect(response.status).toBe(404);
    });
});
