import { FileEntity, UserEntity } from '@kleinkram/backend-common';
import { AccessGroupRights, FileType, UserRole } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    getAuthHeaders,
    uploadFile,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const jsonHeaders = (user: UserEntity): Record<string, string> => ({
    ...getAuthHeaders(user),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
});

async function createProjectWithMission(
    creator: UserEntity,
    label: string,
    accessGroups: { userUuid: string; rights: AccessGroupRights }[] = [],
): Promise<{ projectUuid: string; missionUuid: string }> {
    const suffix = `${label}_${String(Date.now())}_${String(
        Math.floor(Math.random() * 100_000),
    )}`;

    const projectUuid = await createProjectUsingPost(
        {
            name: `move_project_${suffix}`,
            description: 'Move test project',
            requiredTags: [],
            accessGroups,
        },
        creator,
    );

    const missionUuid = await createMissionUsingPost(
        {
            name: `move_mission_${suffix}`,
            projectUUID: projectUuid,
            tags: {},
            ignoreTags: true,
        },
        creator,
    );

    return { projectUuid, missionUuid };
}

/**
 * `PUT /files/:uuid` moves a file whenever the request names a `missionUuid`
 * other than the current one. This is the endpoint the "Edit File" dialog of
 * the frontend uses to change the location of a file.
 */
describe('PUT /files/:uuid moves a file into the mission of the request', () => {
    setupDatabaseHooks();

    test('a user changes the mission of a file through the update endpoint', async () => {
        const { user, projectUuid, missionUuid } = await setupTestEnvironment(
            'test-move-via-update@kleinkram.dev',
            'Move Via Update User',
            UserRole.ADMIN,
        );

        const targetMissionUuid = await createMissionUsingPost(
            {
                name: 'move_via_update_target',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        await uploadFile(user, 'move_me.bag', missionUuid);

        const fileRepository = database.getRepository(FileEntity);
        const file = await fileRepository.findOneOrFail({
            where: { filename: 'move_me.bag' },
            relations: { mission: true },
        });
        expect(file.mission?.uuid).toBe(missionUuid);

        const response = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: jsonHeaders(user),
            body: JSON.stringify({
                uuid: file.uuid,
                filename: file.filename,
                date: file.date,
                missionUuid: targetMissionUuid,
                categories: [],
            }),
        });

        expect(response.status).toBeLessThan(300);

        const movedFile = await fileRepository.findOneOrFail({
            where: { uuid: file.uuid },
            relations: { mission: true },
        });
        expect(movedFile.mission?.uuid).toBe(targetMissionUuid);
    }, 30_000);

    test('a user without CREATE rights on the target mission cannot move a file there', async () => {
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const { user: editor } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // The editor may write the files of the source project ...
        const { missionUuid: sourceMissionUuid } =
            await createProjectWithMission(owner, 'source', [
                { userUuid: editor.uuid, rights: AccessGroupRights.WRITE },
            ]);

        // ... but may only read the target project.
        const { missionUuid: targetMissionUuid } =
            await createProjectWithMission(owner, 'target', [
                { userUuid: editor.uuid, rights: AccessGroupRights.READ },
            ]);

        const fileRepository = database.getRepository(FileEntity);
        const file = await fileRepository.save(
            fileRepository.create({
                filename: 'not_yours.bag',
                mission: { uuid: sourceMissionUuid },
                creator: { uuid: owner.uuid },
                date: new Date(),
                type: FileType.BAG,
                size: 1024,
            }),
        );

        const response = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: jsonHeaders(editor),
            body: JSON.stringify({
                uuid: file.uuid,
                filename: file.filename,
                date: file.date,
                missionUuid: targetMissionUuid,
                categories: [],
            }),
        });

        expect(response.status).toBe(403);

        const unmovedFile = await fileRepository.findOneOrFail({
            where: { uuid: file.uuid },
            relations: { mission: true },
        });
        expect(unmovedFile.mission?.uuid).toBe(sourceMissionUuid);
    }, 30_000);
});
