import FileEntity from '@common/entities/file/file.entity';
import { FileState } from '@common/frontend_shared/enum';
import { DEFAULT_URL } from '../auth/utilities';
import { getAuthHeaders, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('File States Tests', () => {
    setupDatabaseHooks();

    test('should handle file state transitions', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'test-file-states@kleinkram.dev',
            'State User',
        );

        // Upload file - initially it might be in UPLOADING state if we could intercept it,
        // but uploadFile helper waits for completion.
        await uploadFile(user, 'state_test.bag', missionUuid);

        const fileRepo = database.getRepository(FileEntity);
        let file = await fileRepo.findOneOrFail({
            where: { filename: 'state_test.bag' },
        });
        expect(file.state).toBe(FileState.OK);

        // Manually change state to CONVERTING
        file.state = FileState.CONVERTING;
        await fileRepo.save(file);

        file = await fileRepo.findOneOrFail({ where: { uuid: file.uuid } });
        expect(file.state).toBe(FileState.CONVERTING);

        // Manually change state to ERROR
        file.state = FileState.ERROR;
        await fileRepo.save(file);

        file = await fileRepo.findOneOrFail({ where: { uuid: file.uuid } });
        expect(file.state).toBe(FileState.ERROR);

        // Verify we can still retrieve the file in ERROR state via API
        // GET /files?missionUuids[]=:missionUuid
        const response = await fetch(
            `${DEFAULT_URL}/files?missionUuids[]=${missionUuid}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.data).toBeDefined();
        const foundFile = json.data.find((f: any) => f.uuid === file.uuid);
        expect(foundFile).toBeDefined();
        expect(foundFile.state).toBe(FileState.ERROR);
    }, 30_000);
});
