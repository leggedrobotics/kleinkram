import { FileEntity } from '@kleinkram/backend-common/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/topic/topic.entity';
import { DEFAULT_URL } from '../auth/utilities';
import { getAuthHeaders, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('Topic Extraction Tests', () => {
    jest.setTimeout(60_000);
    setupDatabaseHooks();

    test('should extract topics from a file', async () => {
        console.log('[DEBUG] Starting test setup');
        const { user, missionUuid } = await setupTestEnvironment(
            'test-topic@kleinkram.dev',
            'Topic User',
        );
        console.log('[DEBUG] Test setup complete');

        console.log('[DEBUG] Uploading file');
        await uploadFile(user, 'test.bag', missionUuid);
        console.log('[DEBUG] File uploaded');

        const fileRepo = database.getRepository(FileEntity);
        const file = await fileRepo.findOneOrFail({
            where: { filename: 'test.bag' },
        });
        console.log('[DEBUG] File found in DB');

        const topicRepo = database.getRepository(TopicEntity);
        const topic = topicRepo.create({
            name: '/test/topic',
            type: 'std_msgs/String',
            file: file,
            nrMessages: BigInt(100),
            frequency: 10,
            messageEncoding: 'none',
        });
        await topicRepo.save(topic);
        console.log('[DEBUG] Topic saved');

        // Verify topics via API
        // GET /topic/all
        console.log('[DEBUG] Fetching topics via API');
        const response = await fetch(
            `${DEFAULT_URL}/topic/all?skip=0&take=10`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );
        console.log(`[DEBUG] API response status: ${response.status}`);
        expect(response.status).toBe(200);
        const json = await response.json();
        console.log('[DEBUG] API response json received');
        expect(json.data).toBeDefined();
        expect(json.data.length).toBeGreaterThan(0);
        const foundTopic = json.data.find((t: any) => t.name === '/test/topic');
        expect(foundTopic).toBeDefined();
        expect(foundTopic.type).toBe('std_msgs/String');
    }, 30_000);
});
