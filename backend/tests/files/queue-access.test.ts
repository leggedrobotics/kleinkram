import { IngestionJobEntity, UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, QueueState } from '@kleinkram/shared';
import { randomUUID } from 'node:crypto';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

/**
 * Creates a project (owned by `creator`) that grants `accessUser` the given
 * rights, plus one mission inside it.
 */
async function setupProjectWithAccess(
    creator: UserEntity,
    accessUser: UserEntity,
    rights: AccessGroupRights,
): Promise<{ projectUuid: string; missionUuid: string }> {
    const suffix = `${String(Date.now())}_${String(
        Math.floor(Math.random() * 100_000),
    )}`;

    const projectUuid = await createProjectUsingPost(
        {
            name: `queue_project_${suffix}`,
            description: 'Queue access test project',
            requiredTags: [],
            accessGroups: [{ userUuid: accessUser.uuid, rights }],
        },
        creator,
    );

    const missionUuid = await createMissionUsingPost(
        {
            name: `queue_mission_${suffix}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        creator,
    );

    return { projectUuid, missionUuid };
}

async function createQueueEntry(
    missionUuid: string,
    creator: UserEntity,
    state: QueueState = QueueState.AWAITING_UPLOAD,
): Promise<IngestionJobEntity> {
    const repository = database.getRepository(IngestionJobEntity);
    return repository.save(
        repository.create({
            identifier: randomUUID(),
            displayName: 'queued.bag',
            state,
            mission: { uuid: missionUuid },
            creator: { uuid: creator.uuid },
        }),
    );
}

const jsonHeaders = (user: UserEntity): Record<string, string> => ({
    ...getAuthHeaders(user),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
});

/**
 * The `/files/queue/:uuid` routes address an ingestion job, not a mission. The
 * guard therefore has to resolve the owning mission from the job instead of
 * treating the route parameter (or a mission uuid in the body) as the
 * authorized resource.
 */
describe('Queue entry access control', () => {
    setupDatabaseHooks();

    test('a non-admin with DELETE rights can delete a queue entry', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: deleter } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { missionUuid } = await setupProjectWithAccess(
            owner,
            deleter,
            AccessGroupRights.DELETE,
        );
        const queueEntry = await createQueueEntry(missionUuid, owner);

        const response = await fetch(
            `${DEFAULT_URL}/files/queue/${queueEntry.uuid}`,
            {
                method: 'DELETE',
                headers: jsonHeaders(deleter),
                body: JSON.stringify({ missionUUID: missionUuid }),
            },
        );

        expect(response.status).toBeLessThan(300);

        const remaining = await database
            .getRepository(IngestionJobEntity)
            .findOne({ where: { uuid: queueEntry.uuid } });
        expect(remaining).toBeNull();
    }, 30_000);

    test('a non-admin with DELETE rights can cancel a queue entry', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: deleter } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { missionUuid } = await setupProjectWithAccess(
            owner,
            deleter,
            AccessGroupRights.DELETE,
        );
        const queueEntry = await createQueueEntry(missionUuid, owner);

        const response = await fetch(
            `${DEFAULT_URL}/files/queue/${queueEntry.uuid}/cancel`,
            {
                method: 'POST',
                headers: jsonHeaders(deleter),
                body: JSON.stringify({ missionUUID: missionUuid }),
            },
        );

        expect(response.status).toBeLessThan(300);

        const cancelled = await database
            .getRepository(IngestionJobEntity)
            .findOneOrFail({ where: { uuid: queueEntry.uuid } });
        expect(cancelled.state).toBe(QueueState.CANCELED);
    }, 30_000);

    test('a non-admin with DELETE rights passes the guard when stopping a queue entry', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: deleter } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { missionUuid } = await setupProjectWithAccess(
            owner,
            deleter,
            AccessGroupRights.DELETE,
        );
        const queueEntry = await createQueueEntry(missionUuid, owner);

        const response = await fetch(
            `${DEFAULT_URL}/files/queue/${queueEntry.uuid}/stop`,
            {
                method: 'POST',
                headers: jsonHeaders(deleter),
            },
        );

        // The job is not processing, so the handler rejects it with a conflict.
        // What matters here is that authorization no longer fails with a 403:
        // the route carries no mission uuid at all.
        expect(response.status).toBe(409);
    }, 30_000);

    test('a user with only READ rights cannot delete a queue entry', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: reader } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { missionUuid } = await setupProjectWithAccess(
            owner,
            reader,
            AccessGroupRights.READ,
        );
        const queueEntry = await createQueueEntry(missionUuid, owner);

        const response = await fetch(
            `${DEFAULT_URL}/files/queue/${queueEntry.uuid}`,
            {
                method: 'DELETE',
                headers: jsonHeaders(reader),
                body: JSON.stringify({ missionUUID: missionUuid }),
            },
        );

        expect(response.status).toBe(403);
    }, 30_000);

    test('the mission uuid in the body cannot authorize a foreign queue entry', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: attacker } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // The attacker may delete everything in their own mission ...
        const { missionUuid: ownMissionUuid } = await setupProjectWithAccess(
            owner,
            attacker,
            AccessGroupRights.DELETE,
        );

        // ... but has no rights at all on this one.
        const foreign = await setupProjectWithAccess(
            owner,
            owner,
            AccessGroupRights.DELETE,
        );
        const foreignQueueEntry = await createQueueEntry(
            foreign.missionUuid,
            owner,
        );

        const response = await fetch(
            `${DEFAULT_URL}/files/queue/${foreignQueueEntry.uuid}`,
            {
                method: 'DELETE',
                headers: jsonHeaders(attacker),
                body: JSON.stringify({ missionUUID: ownMissionUuid }),
            },
        );

        expect(response.status).toBe(403);

        const remaining = await database
            .getRepository(IngestionJobEntity)
            .findOne({ where: { uuid: foreignQueueEntry.uuid } });
        expect(remaining).not.toBeNull();
    }, 30_000);
});
