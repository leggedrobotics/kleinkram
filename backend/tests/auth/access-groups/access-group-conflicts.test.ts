import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import { getAuthHeaders } from '../../utils/api-calls';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

interface ProjectAccessEntry {
    uuid: string;
    name: string;
    type: string;
    memberCount: number;
    rights: number;
}

const send = async (
    user: UserEntity,
    method: string,
    path: string,
    body?: unknown,
): Promise<{ status: number; json: unknown }> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        method,
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
        status: response.status,
        json: text === '' ? undefined : (JSON.parse(text) as unknown),
    };
};

const projectAccess = async (
    user: UserEntity,
    projectUuid: string,
): Promise<ProjectAccessEntry[]> => {
    const { json } = await send(user, 'GET', `/projects/${projectUuid}/access`);
    return (json as { data: ProjectAccessEntry[] }).data;
};

describe('Access Group Conflicts', () => {
    setupDatabaseHooks();

    test('should return 409 with the name if an access group name is taken', async () => {
        const { user } = await setupTestEnvironment();
        await send(user, 'POST', '/access-groups', { name: 'field-team' });

        const response = await send(user, 'POST', '/access-groups', {
            name: 'field-team',
        });

        expect(response.status).toBe(409);
        expect((response.json as { message: string }).message).toBe(
            'A group named "field-team" already exists',
        );
    });

    test('should delete an access group together with its project access', async () => {
        const { user, projectUuid } = await setupTestEnvironment();
        const created = await send(user, 'POST', '/access-groups', {
            name: 'group-with-access',
        });
        const groupUuid = (created.json as { uuid: string }).uuid;
        const grant = await send(
            user,
            'POST',
            `/access-groups/${groupUuid}/projects/${projectUuid}`,
            { rights: AccessGroupRights.READ },
        );
        expect(grant.status).toBeLessThan(300);
        const accessBefore = await projectAccess(user, projectUuid);
        expect(accessBefore.some((entry) => entry.uuid === groupUuid)).toBe(
            true,
        );

        const response = await send(
            user,
            'DELETE',
            `/access-groups/${groupUuid}`,
        );

        expect(response.status).toBeLessThan(300);
        const accessAfter = await projectAccess(user, projectUuid);
        expect(accessAfter.some((entry) => entry.uuid === groupUuid)).toBe(
            false,
        );
        const lookup = await send(user, 'GET', `/access-groups/${groupUuid}`);
        expect(lookup.status).toBeGreaterThanOrEqual(400);
    });

    test('should not delete the only group with delete rights on a project', async () => {
        const { user, projectUuid } = await setupTestEnvironment();
        const created = await send(user, 'POST', '/access-groups', {
            name: 'only-owners',
        });
        const groupUuid = (created.json as { uuid: string }).uuid;
        // hand the project over: the new group becomes its only owner
        const handover = await send(
            user,
            'POST',
            `/projects/${projectUuid}/access`,
            [
                {
                    uuid: groupUuid,
                    name: 'only-owners',
                    type: 'CUSTOM',
                    memberCount: 1,
                    rights: AccessGroupRights.DELETE,
                },
            ],
        );
        expect(handover.status).toBeLessThan(300);

        const response = await send(
            user,
            'DELETE',
            `/access-groups/${groupUuid}`,
        );

        expect(response.status).toBe(409);
        expect((response.json as { message: string }).message).toContain(
            'is the only group with delete rights',
        );
        const access = await projectAccess(user, projectUuid);
        expect(access.some((entry) => entry.uuid === groupUuid)).toBe(true);
    });

    test('should return 404 if the project access names a group that does not exist', async () => {
        const { user, projectUuid } = await setupTestEnvironment();
        const current = await projectAccess(user, projectUuid);

        const response = await send(
            user,
            'POST',
            `/projects/${projectUuid}/access`,
            [
                ...current,
                {
                    uuid: '0e7d7f4a-5d3c-4b8e-9b1a-2f4d6c8e0a1b',
                    name: 'ghost',
                    type: 'CUSTOM',
                    memberCount: 0,
                    rights: AccessGroupRights.READ,
                },
            ],
        );

        expect(response.status).toBe(404);
        expect((response.json as { message: string }).message).toBe(
            'Access group not found',
        );
    });
});
