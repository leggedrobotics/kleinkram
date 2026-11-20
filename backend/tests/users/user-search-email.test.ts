import {
    AccessGroupEntity,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupType } from '@kleinkram/shared';
import * as assert from 'node:assert';
import { DEFAULT_URL } from '../auth/utilities';
import { HeaderCreator } from '../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

interface SearchResult {
    uuid: string;
    name: string;
    email: string | null;
    emailHint?: string | null;
}

/** Creates a user with a name that the search below finds */
const createUser = async (email: string): Promise<UserEntity> => {
    const uuid = await mockDatabaseUser(
        email,
        `emailhint ${email.split('@')[0] ?? ''}`,
    );
    return getUserFromDatabase(uuid);
};

/** Puts the users into a new affiliation group (the email-domain groups) */
const createAffiliationGroup = async (
    members: { user: UserEntity; expirationDate?: Date }[],
): Promise<void> => {
    const group = await database.getRepository(AccessGroupEntity).save({
        name: `Affiliation ${crypto.randomUUID()}`,
        type: AccessGroupType.AFFILIATION,
    });
    const memberships = database.getRepository(GroupMembershipEntity);
    for (const { user, expirationDate } of members) {
        await memberships.save({
            accessGroup: group,
            user,
            canEditGroup: false,
            ...(expirationDate ? { expirationDate } : {}),
        });
    }
};

/** The search results and the raw response body */
const search = async (
    requester: UserEntity,
    term: string,
): Promise<{ users: SearchResult[]; raw: string }> => {
    const headers = new HeaderCreator(requester);
    const response = await fetch(
        `${DEFAULT_URL}/users/search?search=${encodeURIComponent(term)}`,
        { headers: headers.getHeaders() },
    );
    assert.equal(response.status, 200);
    const raw = await response.text();
    const body = JSON.parse(raw) as { users: SearchResult[] };
    return { users: body.users, raw };
};

const find = (
    results: { users: SearchResult[] },
    user: UserEntity,
): SearchResult => {
    const result = results.users.find((r) => r.uuid === user.uuid);
    assert.ok(result, `${user.name} should be found`);
    return result;
};

describe('User Search Email Visibility', () => {
    setupDatabaseHooks();

    test('should return the full email of a user in the same affiliation group', async () => {
        const requester = await createUser('requester@search-a.example');
        const peer = await createUser('peer@search-a.example');
        await createAffiliationGroup([{ user: requester }, { user: peer }]);

        const result = find(await search(requester, 'emailhint'), peer);

        assert.equal(result.email, 'peer@search-a.example');
        assert.equal(result.emailHint, 'peer@search-a.example');
    });

    test('should mask the email of a user without a shared affiliation group', async () => {
        const requester = await createUser('requester@search-a.example');
        const stranger = await createUser('stranger@search-b.example');
        await createAffiliationGroup([{ user: requester }]);
        await createAffiliationGroup([{ user: stranger }]);

        const response = await search(requester, 'emailhint');
        const result = find(response, stranger);

        assert.equal(result.email, null);
        assert.equal(result.emailHint, 's•••••@search-b.example');
        // the full address must not be anywhere in the response
        expect(response.raw).not.toContain('stranger@search-b.example');
    });

    test('should return the full email on an exact email match', async () => {
        const requester = await createUser('requester@search-a.example');
        const stranger = await createUser('stranger@search-b.example');

        const result = find(
            await search(requester, 'stranger@search-b.example'),
            stranger,
        );

        assert.equal(result.email, 'stranger@search-b.example');
        assert.equal(result.emailHint, 'stranger@search-b.example');
    });

    test('should mask the email if the shared membership has expired', async () => {
        const requester = await createUser('requester@search-a.example');
        const former = await createUser('former@search-a.example');
        await createAffiliationGroup([
            { user: requester },
            // two days ago: well clear of any time zone offset between the
            // test runner and the database
            {
                user: former,
                expirationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
        ]);

        const response = await search(requester, 'emailhint');
        const result = find(response, former);

        assert.equal(result.email, null);
        assert.equal(result.emailHint, 'f•••••@search-a.example');
        expect(response.raw).not.toContain('former@search-a.example');
    });
});
