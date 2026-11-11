import { GroupMembershipEntity, UserEntity } from '@kleinkram/backend-common';
import {
    createAccessGroupUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * Make `user` an editor of the group whose membership already expired.
 * Uses a full day in the past: the column has no time zone and the API
 * compares against the database's NOW() (UTC).
 */
const makeExpiredEditor = async (
    groupUuid: string,
    user: UserEntity,
): Promise<void> => {
    const repo = database.getRepository(GroupMembershipEntity);
    const membership = await repo.findOneOrFail({
        where: { accessGroup: { uuid: groupUuid }, user: { uuid: user.uuid } },
    });
    membership.canEditGroup = true;
    membership.expirationDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await repo.save(membership);
};

const request = async (
    user: UserEntity,
    method: string,
    path: string,
    body?: unknown,
): Promise<number> => {
    const headers = new HeaderCreator(user);
    headers.addHeader('Content-Type', 'application/json');
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: headers.getHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response.status;
};

describe('Expired group editors', () => {
    setupDatabaseHooks();

    test('an editor whose membership expired cannot edit the group', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: expiredEditor } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const { user: target } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'expired_editor_group' },
            creator,
            [creator, expiredEditor],
        );
        await makeExpiredEditor(groupUuid, expiredEditor);

        expect(
            await request(
                expiredEditor,
                'POST',
                `/access-groups/${groupUuid}/users`,
                { userUuid: target.uuid },
            ),
        ).toBe(403);
        expect(
            await request(
                expiredEditor,
                'DELETE',
                `/access-groups/${groupUuid}/users/${creator.uuid}`,
            ),
        ).toBe(403);
        expect(
            await request(
                expiredEditor,
                'GET',
                `/access-groups/${groupUuid}/audit-logs`,
            ),
        ).toBe(403);
        expect(
            await request(
                expiredEditor,
                'DELETE',
                `/access-groups/${groupUuid}`,
            ),
        ).toBe(403);
    });

    test('the last active editor cannot leave when the other editors expired', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: expiredEditor } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'last_active_editor_remove' },
            creator,
            [creator, expiredEditor],
        );
        await makeExpiredEditor(groupUuid, expiredEditor);

        expect(
            await request(
                creator,
                'DELETE',
                `/access-groups/${groupUuid}/users`,
                {
                    userUuids: [creator.uuid],
                },
            ),
        ).toBe(409);
    });

    test('the last active editor cannot demote themselves, but can demote an expired editor', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: expiredEditor } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'last_active_editor_demote' },
            creator,
            [creator, expiredEditor],
        );
        await makeExpiredEditor(groupUuid, expiredEditor);

        expect(
            await request(
                creator,
                'PUT',
                `/access-groups/${groupUuid}/users/${creator.uuid}/permissions`,
                { canEditGroup: false },
            ),
        ).toBe(409);
        expect(
            await request(
                creator,
                'PUT',
                `/access-groups/${groupUuid}/users/${expiredEditor.uuid}/permissions`,
                { canEditGroup: false },
            ),
        ).toBe(200);
    });
});
