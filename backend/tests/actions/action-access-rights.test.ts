import {
    AccessGroupEntity,
    ActionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, ActionState } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';
import { createMockWorker } from '../utils/test-helpers';

describe('Action Access Rights', () => {
    beforeAll(async () => {
        await database.initialize();
    });

    beforeEach(async () => {
        await clearAllData();
    });

    afterAll(async () => {
        await database.destroy();
    });

    test('if a user can only start an action if they have sufficient rights', async () => {
        // 1. Create a user (creator)
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // 2. Create a project and mission
        const projectUUID = await createProjectUsingPost(
            {
                name: 'access_rights_project',
                description: 'Test project for access rights',
            },
            creator,
        );
        expect(projectUUID).toBeDefined();

        const missionUUID = await createMissionUsingPost(
            {
                name: 'access_rights_mission',
                projectUUID: projectUUID,
                metadata: {},
                ignoreMissingMetadata: false,
            },
            creator,
        );
        expect(missionUUID).toBeDefined();

        // 3. Create another user (limitedUser)
        const { user: limitedUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        // 4. Create Action Template requiring WRITE rights
        const writeHeaders = new HeaderCreator(creator);
        writeHeaders.addHeader('Content-Type', 'application/json');
        const writeTemplateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: writeHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'write_access_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 512,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.WRITE,
            }),
        });
        if (writeTemplateResponse.status !== 201) {
            console.log(
                '[DEBUG] Template creation error:',
                await writeTemplateResponse.text(),
            );
        }
        expect(writeTemplateResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { uuid: writeTemplateUUID } = await writeTemplateResponse.json();

        // 5. Create Action Template requiring READ rights
        const readHeaders = new HeaderCreator(creator);
        readHeaders.addHeader('Content-Type', 'application/json');
        const readTemplateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: readHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'read_access_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 512,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.READ,
            }),
        });
        expect(readTemplateResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { uuid: readTemplateUUID } = await readTemplateResponse.json();

        // 6. Try to submit WRITE action as limitedUser (should fail 403)
        const limitedHeaders = new HeaderCreator(limitedUser);
        limitedHeaders.addHeader('Content-Type', 'application/json');
        const failResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: limitedHeaders.getHeaders(),
            body: JSON.stringify({
                missionUUID: missionUUID,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                templateUUID: writeTemplateUUID,
            }),
        });
        expect(failResponse.status).toBe(403);

        // 7. Try to submit READ action as limitedUser (should also fail 403 if they have NO rights)
        const failReadResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: limitedHeaders.getHeaders(),
            body: JSON.stringify({
                missionUUID: missionUUID,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                templateUUID: readTemplateUUID,
            }),
        });
        expect(failReadResponse.status).toBe(403);
    });

    test('if launching an action needs WRITE even when the template only asks for READ', async () => {
        await createMockWorker('launch-write-test-worker');

        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const usersByRight = new Map<AccessGroupRights, string>();
        const accessGroups: {
            rights: AccessGroupRights;
            accessGroupUUID: string;
        }[] = [];
        for (const rights of [
            AccessGroupRights.READ,
            AccessGroupRights.CREATE,
            AccessGroupRights.WRITE,
        ]) {
            const { user } = await generateAndFetchDatabaseUser(
                'internal',
                'user',
            );
            const group = await accessGroupRepository.findOneOrFail({
                where: { name: user.name },
            });
            usersByRight.set(rights, user.uuid);
            accessGroups.push({ rights, accessGroupUUID: group.uuid });
        }

        const projectUUID = await createProjectUsingPost(
            {
                name: 'launch_write_project',
                description: 'Test project for launch rights',
                accessGroups,
            },
            creator,
        );
        const missionUUID = await createMissionUsingPost(
            {
                name: 'launch_write_mission',
                projectUUID,
                metadata: {},
                ignoreMissingMetadata: false,
            },
            creator,
        );

        const creatorHeaders = new HeaderCreator(creator);
        creatorHeaders.addHeader('Content-Type', 'application/json');
        const templateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: creatorHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'launch_write_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 2,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.READ,
            }),
        });
        expect(templateResponse.status).toBe(201);
        const { uuid: templateUUID } = (await templateResponse.json()) as {
            uuid: string;
        };

        const submitAs = async (rights: AccessGroupRights): Promise<number> => {
            const userUuid = usersByRight.get(rights);
            const user = await database
                .getRepository(UserEntity)
                .findOneOrFail({ where: { uuid: userUuid } });
            const headers = new HeaderCreator(user);
            headers.addHeader('Content-Type', 'application/json');
            const single = await fetch(`${DEFAULT_URL}/actions`, {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({ missionUUID, templateUUID }),
            });
            const batch = await fetch(`${DEFAULT_URL}/actions/batch`, {
                method: 'POST',
                headers: headers.getHeaders(),
                body: JSON.stringify({
                    missionUUIDs: [missionUUID],
                    templateUUID,
                }),
            });
            expect(batch.status).toBe(single.status);
            return single.status;
        };

        expect(await submitAs(AccessGroupRights.READ)).toBe(403);
        expect(await submitAs(AccessGroupRights.CREATE)).toBe(403);
        expect(await submitAs(AccessGroupRights.WRITE)).toBe(201);
    });

    test('if a user can cancel an action based on their rights', async () => {
        // Create worker first so actions can be submitted successfully
        await createMockWorker('cancel-test-worker');

        // 1. Create a user (creator) and another user (member)
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: member } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { user: reader } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // Get the member's and the reader's access groups
        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const accessGroupMember = await accessGroupRepository.findOneOrFail({
            where: { name: member.name },
        });
        const accessGroupReader = await accessGroupRepository.findOneOrFail({
            where: { name: reader.name },
        });

        // 2. Create a project and mission. Grant WRITE rights to the member
        //    group and READ rights to the reader group
        const projectUUID = await createProjectUsingPost(
            {
                name: 'cancel_access_project',
                description: 'Test project for cancel access rights',
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        accessGroupUUID: accessGroupMember.uuid,
                    },
                    {
                        rights: AccessGroupRights.READ,
                        accessGroupUUID: accessGroupReader.uuid,
                    },
                ],
            },
            creator,
        );
        expect(projectUUID).toBeDefined();

        const missionUUID = await createMissionUsingPost(
            {
                name: 'cancel_access_mission',
                projectUUID: projectUUID,
                metadata: {},
                ignoreMissingMetadata: false,
            },
            creator,
        );
        expect(missionUUID).toBeDefined();

        // 3. Create Action Template requiring READ rights
        const creatorHeaders = new HeaderCreator(creator);
        creatorHeaders.addHeader('Content-Type', 'application/json');
        const templateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: creatorHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'cancel_access_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 2,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.READ,
            }),
        });
        expect(templateResponse.status).toBe(201);
        const { uuid: templateUUID } = (await templateResponse.json()) as {
            uuid: string;
        };

        // 4. Submit Action as creator
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: creatorHeaders.getHeaders(),
            body: JSON.stringify({
                missionUUID: missionUUID,
                templateUUID: templateUUID,
            }),
        });
        expect(submitResponse.status).toBe(201);
        const { actionUUID } = (await submitResponse.json()) as {
            actionUUID: string;
        };

        // Set action state to PENDING so it's cancelable
        const actionRepo = database.getRepository(ActionEntity);
        await actionRepo.update(
            { uuid: actionUUID },
            { state: ActionState.PENDING },
        );

        // 5. Try to cancel as an external user (no rights) -> should fail 403
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const externalHeaders = new HeaderCreator(externalUser);
        const failCancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/cancel`,
            {
                method: 'POST',
                headers: externalHeaders.getHeaders(),
            },
        );
        expect(failCancelResponse.status).toBe(403);

        // 6. Try to cancel as a READ-only user -> should fail 403: stopping an
        //    action needs the same rights as launching it, i.e. at least WRITE
        const readerHeaders = new HeaderCreator(reader);
        const readerCancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/cancel`,
            {
                method: 'POST',
                headers: readerHeaders.getHeaders(),
            },
        );
        expect(readerCancelResponse.status).toBe(403);

        // Try to cancel as member user (has WRITE rights to mission, template requires READ) -> should succeed 201
        const memberHeaders = new HeaderCreator(member);
        const memberCancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/cancel`,
            {
                method: 'POST',
                headers: memberHeaders.getHeaders(),
            },
        );
        expect(memberCancelResponse.status).toBe(201);

        // Reset state back to PENDING for the next cancel attempts
        await actionRepo.update(
            { uuid: actionUUID },
            { state: ActionState.PENDING },
        );

        // 7. Try to cancel as admin user (no explicit group access but is admin) -> should succeed 201
        const { user: admin } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        const adminHeaders = new HeaderCreator(admin);
        const adminCancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/cancel`,
            {
                method: 'POST',
                headers: adminHeaders.getHeaders(),
            },
        );
        expect(adminCancelResponse.status).toBe(201);

        // Reset state back to PENDING for creator cancel check
        await actionRepo.update(
            { uuid: actionUUID },
            { state: ActionState.PENDING },
        );

        // 8. Try to cancel as the creator -> should succeed 201
        const creatorCancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}/cancel`,
            {
                method: 'POST',
                headers: creatorHeaders.getHeaders(),
            },
        );
        expect(creatorCancelResponse.status).toBe(201);
    });
});
