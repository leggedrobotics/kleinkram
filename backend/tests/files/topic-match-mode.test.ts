import { FileEntity, TopicEntity } from '@kleinkram/backend-common';
import { DEFAULT_URL } from '../auth/utilities';
import { getAuthHeaders, uploadFile } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

/**
 * `matchAllTopics=false` used to be coerced to `true` by
 * `@Type(() => Boolean)`, so the "any of these topics" (OR) search behaved like
 * an "all of these topics" (AND) search.
 */
describe('File topic match mode', () => {
    jest.setTimeout(60_000);
    setupDatabaseHooks();

    test('matchAllTopics toggles between OR and AND topic search', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'topic-match-mode@kleinkram.dev',
            'Topic Match Mode User',
        );

        await uploadFile(user, 'test.bag', missionUuid);

        const file = await database.getRepository(FileEntity).findOneOrFail({
            where: { filename: 'test.bag' },
        });

        const topicRepository = database.getRepository(TopicEntity);
        await topicRepository.save(
            topicRepository.create({
                name: '/present/topic',
                type: 'std_msgs/String',
                file: file,
                nrMessages: 10n,
                frequency: 1,
                messageEncoding: 'none',
            }),
        );

        const queryFiles = async (
            matchAllTopics: string,
        ): Promise<string[]> => {
            const response = await fetch(
                `${DEFAULT_URL}/files?missionUuids=${missionUuid}&topics=/present/topic,/absent/topic&matchAllTopics=${matchAllTopics}&take=10&skip=0`,
                { method: 'GET', headers: getAuthHeaders(user) },
            );
            expect(response.status).toBe(200);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const json = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
            return json.data.map((f: any) => f.uuid);
        };

        // OR: the file has one of the two topics, so it matches
        expect(await queryFiles('false')).toContain(file.uuid);

        // AND: the file is missing '/absent/topic', so it does not match
        expect(await queryFiles('true')).not.toContain(file.uuid);
    });
});
