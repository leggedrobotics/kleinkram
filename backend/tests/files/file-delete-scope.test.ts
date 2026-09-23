import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, FileType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

async function setupProjectWithAccess(
    creator: UserEntity,
    accessUser: UserEntity,
    rights: AccessGroupRights,
    label: string,
): Promise<{ projectUuid: string; missionUuid: string }> {
    const suffix = `${label}_${String(Date.now())}_${String(
        Math.floor(Math.random() * 100_000),
    )}`;

    const projectUuid = await createProjectUsingPost(
        {
            name: `delete_scope_project_${suffix}`,
            description: 'Delete scope test project',
            requiredTags: [],
            accessGroups: [{ userUuid: accessUser.uuid, rights }],
        },
        creator,
    );

    const missionUuid = await createMissionUsingPost(
        {
            name: `delete_scope_mission_${suffix}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        creator,
    );

    return { projectUuid, missionUuid };
}

async function createTestFile(
    filename: string,
    missionUuid: string,
    creator: UserEntity,
): Promise<FileEntity> {
    const fileRepository = database.getRepository(FileEntity);
    return fileRepository.save(
        fileRepository.create({
            filename,
            mission: { uuid: missionUuid },
            creator: { uuid: creator.uuid },
            date: new Date(),
            type: FileType.BAG,
            size: 1024,
        }),
    );
}

const jsonHeaders = (user: UserEntity): Record<string, string> => ({
    ...getAuthHeaders(user),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
});

/**
 * `DELETE /files` deletes the files of the mission named in the request body.
 * The guard has to authorize against exactly that mission, never against a
 * mission uuid a caller appends to the query string.
 */
describe('DELETE /files authorizes against the mission in the body', () => {
    setupDatabaseHooks();

    test('a uuid in the query string cannot authorize a deletion in another mission', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: attacker } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // The attacker may delete everything in mission A ...
        const { missionUuid: missionA } = await setupProjectWithAccess(
            owner,
            attacker,
            AccessGroupRights.DELETE,
            'a',
        );

        // ... and has no rights on mission B.
        const { missionUuid: missionB } = await setupProjectWithAccess(
            owner,
            owner,
            AccessGroupRights.DELETE,
            'b',
        );
        const fileInB = await createTestFile('victim.bag', missionB, owner);

        const response = await fetch(`${DEFAULT_URL}/files?uuid=${missionA}`, {
            method: 'DELETE',
            headers: jsonHeaders(attacker),
            body: JSON.stringify({
                uuids: [fileInB.uuid],
                missionUUID: missionB,
            }),
        });

        expect(response.status).toBe(403);

        const survivor = await database
            .getRepository(FileEntity)
            .findOne({ where: { uuid: fileInB.uuid } });
        expect(survivor).not.toBeNull();
    }, 30_000);

    test('a user with DELETE rights can still delete files of their own mission', async () => {
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
            'own',
        );
        const file = await createTestFile('own.bag', missionUuid, owner);

        const response = await fetch(`${DEFAULT_URL}/files`, {
            method: 'DELETE',
            headers: jsonHeaders(deleter),
            body: JSON.stringify({
                uuids: [file.uuid],
                missionUUID: missionUuid,
            }),
        });

        expect(response.status).not.toBe(403);
    }, 30_000);
});
