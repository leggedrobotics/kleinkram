import { FileState, UserRole } from '@kleinkram/backend-common';
import { FileEntity } from '@kleinkram/backend-common/file/file.entity';
import { DEFAULT_URL } from '../auth/utilities';
import {
    createMissionUsingPost,
    getAuthHeaders,
    uploadFile,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('File Management Tests', () => {
    setupDatabaseHooks();

    test('should upload and download a file', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-file@kleinkram.dev',
            'File User',
            UserRole.ADMIN,
        );

        // Upload
        // Note: uploadFile utility mocks the multipart upload process
        await uploadFile(user, 'test.bag', missionUuid);

        // Verify file exists in DB
        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOne({
            where: { filename: 'test.bag' },
            relations: ['mission'],
        });
        expect(file).not.toBeNull();
        expect(file?.mission?.uuid).toBe(missionUuid);

        expect(file?.state).toBe(FileState.OK);

        // Download
        const downloadResponse = await fetch(
            `${DEFAULT_URL}/files/download?uuid=${file?.uuid}&expires=false&preview_only=false`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(downloadResponse.status).toBeLessThan(300);
    }, 30_000);

    test('should delete a file', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-delete@kleinkram.dev',
            'Delete User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'to_delete.bag', missionUuid);
        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'to_delete.bag' },
        });

        const deleteResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(user),
            },
        );
        expect(deleteResponse.status).toBeLessThan(300);

        const deletedFile = await fileRepo.findOne({
            where: { uuid: file.uuid },
        });
        expect(deletedFile).toBeNull();
    }, 30_000);

    test('should delete multiple files', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-multi-delete@kleinkram.dev',
            'Multi Delete User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'file1.bag', missionUuid);
        await uploadFile(user, 'file2.bag', missionUuid);

        const fileRepo = database.getRepository(FileEntity);
        const file1 = await fileRepo.findOneOrFail({
            where: { filename: 'file1.bag' },
        });
        const file2 = await fileRepo.findOneOrFail({
            where: { filename: 'file2.bag' },
        });

        const deleteResponse = await fetch(
            `${DEFAULT_URL}/files/deleteMultiple`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(user),
                },
                body: JSON.stringify({
                    uuids: [file1.uuid, file2.uuid],
                    missionUUID: missionUuid,
                }),
            },
        );
        expect(deleteResponse.status).toBeLessThan(300);

        const deletedFile1 = await fileRepo.findOne({
            where: { uuid: file1.uuid },
        });
        const deletedFile2 = await fileRepo.findOne({
            where: { uuid: file2.uuid },
        });
        expect(deletedFile1).toBeNull();
        expect(deletedFile2).toBeNull();
    }, 30_000);

    test('should move file to another mission', async () => {
        const { user, missionUuid, projectUuid } = await setupTestEnvironment(
            'test-move@kleinkram.dev',
            'Move User',
            UserRole.ADMIN,
        );

        const mission1Uuid = missionUuid; // Renaming for clarity, as missionUuid from setupTestEnvironment is the first mission
        const mission2Uuid = await createMissionUsingPost(
            {
                name: 'mission_2',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        await uploadFile(user, 'move_me.bag', mission1Uuid);
        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'move_me.bag' },
            relations: ['mission'],
        });
        expect(file?.mission?.uuid).toBe(mission1Uuid);

        const moveResponse = await fetch(`${DEFAULT_URL}/files/moveFiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                fileUUIDs: [file.uuid],
                missionUUID: mission2Uuid,
            }),
        });
        expect(moveResponse.status).toBeLessThan(300);

        const movedFile = await fileRepo.findOneOrFail({
            where: { uuid: file.uuid },
            relations: ['mission'],
        });
        expect(movedFile?.mission?.uuid).toBe(mission2Uuid);
    }, 30_000);
});
