import type { AccessGroupsDto } from '@kleinkram/api-dto';
import { GroupMembershipEntity, UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import {
    createAccessGroupUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

const listMine = async (
    user: UserEntity,
): Promise<{ status: number; body: AccessGroupsDto }> => {
    const headers = new HeaderCreator(user);
    const response = await fetch(
        `${DEFAULT_URL}/users/me/access-groups?search=&skip=0&take=50`,
        { method: 'GET', headers: headers.getHeaders() },
    );
    return {
        status: response.status,
        body: (await response.json()) as AccessGroupsDto,
    };
};

/**
 * GET /users/me/access-groups: every user, including external ones, can list the
 * groups they belong to (issue #792) without learning anything else.
 */
describe('List own access groups', () => {
    setupDatabaseHooks();

    test('external user sees their primary group and custom groups they belong to', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: external } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const memberGroup = await createAccessGroupUsingPost(
            { name: 'shared_with_external' },
            creator,
            [creator, external],
        );
        const otherGroup = await createAccessGroupUsingPost(
            { name: 'not_shared_with_external' },
            creator,
            [creator],
        );

        const { status, body } = await listMine(external);
        expect(status).toBe(200);

        const uuids = body.data.map((group) => group.uuid);
        expect(uuids).toContain(memberGroup);
        expect(uuids).not.toContain(otherGroup);
        expect(
            body.data.filter((group) => group.type === AccessGroupType.PRIMARY),
        ).toHaveLength(1);
        expect(body.count).toBe(2);
    });

    test('list never exposes member emails, not even to group editors', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: external } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        await createAccessGroupUsingPost({ name: 'email_check' }, creator, [
            creator,
            external,
        ]);

        for (const user of [creator, external]) {
            const { body } = await listMine(user);
            for (const group of body.data) {
                for (const membership of group.memberships) {
                    expect(membership.user.email ?? null).toBeNull();
                }
            }
        }
    });

    test('expired memberships are not listed and do not grant detail access', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: external } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'expired_membership' },
            creator,
            [creator, external],
        );

        const membershipRepo = database.getRepository(GroupMembershipEntity);
        const membership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: external.uuid },
            },
        });
        membership.expirationDate =
            // a full day: the column has no time zone and NOW() runs in UTC
            new Date(Date.now() - 24 * 60 * 60 * 1000);
        await membershipRepo.save(membership);

        const { body } = await listMine(external);
        expect(body.data.map((group) => group.uuid)).not.toContain(groupUuid);

        const headers = new HeaderCreator(external);
        const detail = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(detail.status).toBe(403);
    });

    test('an expired member of a group with projects cannot open its details', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: external } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'expired_with_project' },
            creator,
            [creator, external],
        );
        const projectUuid = await createProjectUsingPost(
            {
                name: 'expired_with_project_project',
                description: 'project shared through the group',
                requiredMetadataTypes: [],
            },
            creator,
        );
        const creatorHeaders = new HeaderCreator(creator);
        creatorHeaders.addHeader('Content-Type', 'application/json');
        const linked = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}/projects/${projectUuid}`,
            {
                method: 'POST',
                headers: creatorHeaders.getHeaders(),
                body: JSON.stringify({ rights: AccessGroupRights.READ }),
            },
        );
        expect(linked.status).toBeLessThan(300);

        const membershipRepo = database.getRepository(GroupMembershipEntity);
        const membership = await membershipRepo.findOneOrFail({
            where: {
                accessGroup: { uuid: groupUuid },
                user: { uuid: external.uuid },
            },
        });
        // a full day: the column has no time zone and NOW() runs in UTC
        membership.expirationDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await membershipRepo.save(membership);

        const headers = new HeaderCreator(external);
        const detail = await fetch(
            `${DEFAULT_URL}/access-groups/${groupUuid}`,
            {
                method: 'GET',
                headers: headers.getHeaders(),
            },
        );
        expect(detail.status).toBe(403);
    });

    test('member can open group details, but only editors see emails', async () => {
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: external } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const groupUuid = await createAccessGroupUsingPost(
            { name: 'detail_emails' },
            creator,
            [creator, external],
        );

        const fetchDetail = async (
            user: UserEntity,
        ): Promise<AccessGroupsDto['data'][number]> => {
            const headers = new HeaderCreator(user);
            const response = await fetch(
                `${DEFAULT_URL}/access-groups/${groupUuid}`,
                { method: 'GET', headers: headers.getHeaders() },
            );
            expect(response.status).toBe(200);
            return (await response.json()) as AccessGroupsDto['data'][number];
        };

        const asMember = await fetchDetail(external);
        for (const membership of asMember.memberships) {
            expect(membership.user.email ?? null).toBeNull();
        }

        const asEditor = await fetchDetail(creator);
        expect(
            asEditor.memberships.every(
                (membership) => typeof membership.user.email === 'string',
            ),
        ).toBe(true);
    });
});
