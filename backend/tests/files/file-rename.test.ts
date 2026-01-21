import { FileEntity } from '@kleinkram/backend-common';
import { UserRole } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { HeaderCreator, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('File Rename Bug Verification', () => {
    setupDatabaseHooks();

    test('should succeed to rename a .yaml file', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-rename-yaml@kleinkram.dev',
            'Rename User',
            UserRole.ADMIN,
        );

        // 1. Upload a .yaml file
        await uploadFile(user, 'config.yaml', missionUuid);

        // 2. Find it in DB
        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'config.yaml' },
        });

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');

        // 3. Attempt to rename it
        const renameResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    uuid: file.uuid,
                    date: file.date,
                    filename: 'new_config.yaml',
                }),
            },
        );

        expect(renameResponse.status).toBeLessThan(300);
        const updatedFile = await fileRepo.findOneOrFail({
            where: { uuid: file.uuid },
        });
        expect(updatedFile.filename).toBe('new_config.yaml');
    }, 30_000);

    test('should succeed to rename a .yml file', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-rename-yml@kleinkram.dev',
            'Rename User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'config.yml', missionUuid);

        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'config.yml' },
        });

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');

        const renameResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    uuid: file.uuid,
                    date: file.date,
                    filename: 'renamed_config.yml',
                }),
            },
        );

        expect(renameResponse.status).toBeLessThan(300);
        const updatedFile = await fileRepo.findOneOrFail({
            where: { uuid: file.uuid },
        });
        expect(updatedFile.filename).toBe('renamed_config.yml');
    }, 30_000);

    test('should fail if changing extension (e.g. .bag to .mcap)', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-rename-invalid@kleinkram.dev',
            'Rename User',
            UserRole.ADMIN,
        );

        await uploadFile(user, 'test.bag', missionUuid);

        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'test.bag' },
        });

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');

        const renameResponse = await fetch(
            `${DEFAULT_URL}/files/${file.uuid}`,
            {
                method: 'PUT',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    uuid: file.uuid,
                    date: file.date,
                    filename: 'test.mcap',
                }),
            },
        );

        expect(renameResponse.status).toBe(400);
        const error = (await renameResponse.json()) as { message: string };
        expect(error.message).toContain('File ending must be one of');
    }, 30_000);

    test('should allow .yaml <-> .yml rename but fail for others', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-yaml-yml-swap@kleinkram.dev',
            'Rename User',
            UserRole.ADMIN,
        );

        // 1. Upload .yaml
        await uploadFile(user, 'config.yaml', missionUuid);
        const fileRepo = database.getRepository(FileEntity);
        let file = await fileRepo.findOneOrFail({
            where: { filename: 'config.yaml' },
        });

        const headers = new HeaderCreator(user);
        headers.addHeader('Content-Type', 'application/json');

        // 2. Rename .yaml -> .yml (Should Succeed)
        let renameResponse = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                uuid: file.uuid,
                date: file.date,
                filename: 'config.yml',
            }),
        });
        expect(renameResponse.status).toBeLessThan(300);
        file = await fileRepo.findOneOrFail({ where: { uuid: file.uuid } });
        expect(file.filename).toBe('config.yml');

        // 3. Rename .yml -> .yaml (Should Succeed)
        renameResponse = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                uuid: file.uuid,
                date: file.date,
                filename: 'config.yaml',
            }),
        });
        expect(renameResponse.status).toBeLessThan(300);
        file = await fileRepo.findOneOrFail({ where: { uuid: file.uuid } });
        expect(file.filename).toBe('config.yaml');

        // 4. Rename .yaml -> .bag (Should Fail)
        renameResponse = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: headers.getHeaders(),
            body: JSON.stringify({
                uuid: file.uuid,
                date: file.date,
                filename: 'config.bag',
            }),
        });
        expect(renameResponse.status).toBe(400);
        const error = (await renameResponse.json()) as { message: string };
        expect(error.message).toContain('File ending must be one of');
    }, 30_000);
});
