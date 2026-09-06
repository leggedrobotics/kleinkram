import { appVersion } from '@/app-version';
import {
    ApiKeyEntity,
    FileEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupRights,
    FileType,
    KeyTypes,
    UserRole,
} from '@kleinkram/shared';
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
        // An external user: every internal user is a member of the affiliation
        // group of `access_config.json`, which every new project grants CREATE
        // rights to, so an internal user could legitimately move files here.
        const { user: editor } = await generateAndFetchDatabaseUser(
            'external',
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

    test('an API key cannot move a file out of the mission it is scoped to', async () => {
        // The key belongs to an admin: without the check on the update path,
        // the rights of the key owner would authorize the move even though the
        // key itself is scoped to a single mission.
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        const { missionUuid: sourceMissionUuid } =
            await createProjectWithMission(owner, 'key_source');
        const { missionUuid: targetMissionUuid } =
            await createProjectWithMission(owner, 'key_target');

        const fileRepository = database.getRepository(FileEntity);
        const file = await fileRepository.save(
            fileRepository.create({
                filename: 'scoped.bag',
                mission: { uuid: sourceMissionUuid },
                creator: { uuid: owner.uuid },
                date: new Date(),
                type: FileType.BAG,
                size: 1024,
            }),
        );

        const apiKeyRepository = database.getRepository(ApiKeyEntity);
        const apiKey = apiKeyRepository.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: sourceMissionUuid },
            rights: AccessGroupRights.WRITE,
            user: { uuid: owner.uuid },
        });
        await apiKeyRepository.save(apiKey);

        const response = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'x-api-key': apiKey.apikey,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'kleinkram-client-version': appVersion,
            },
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

    test('an API key can still rename a file within its own mission', async () => {
        // Positive counterpart of the move rejection (ported from #2293):
        // the API-key restriction only applies to changing the mission.
        const { user: owner } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { missionUuid } = await createProjectWithMission(
            owner,
            'key_rename',
        );

        // the update path re-tags the object in storage, so the file has to
        // exist there (a database-only row would make the request fail)
        await uploadFile(owner, 'before.bag', missionUuid);
        const fileRepository = database.getRepository(FileEntity);
        const file = await fileRepository.findOneOrFail({
            where: { filename: 'before.bag' },
        });

        const apiKeyRepository = database.getRepository(ApiKeyEntity);
        const apiKey = apiKeyRepository.create({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            mission: { uuid: missionUuid },
            rights: AccessGroupRights.WRITE,
            user: { uuid: owner.uuid },
        });
        await apiKeyRepository.save(apiKey);

        const response = await fetch(`${DEFAULT_URL}/files/${file.uuid}`, {
            method: 'PUT',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'x-api-key': apiKey.apikey,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'kleinkram-client-version': appVersion,
            },
            body: JSON.stringify({
                uuid: file.uuid,
                filename: 'after.bag',
                date: file.date,
                missionUuid,
                categories: [],
            }),
        });

        expect(response.status).toBeLessThan(300);

        const renamedFile = await fileRepository.findOneOrFail({
            where: { uuid: file.uuid },
            relations: { mission: true },
        });
        expect(renamedFile.filename).toBe('after.bag');
        expect(renamedFile.mission?.uuid).toBe(missionUuid);
    }, 30_000);
});
