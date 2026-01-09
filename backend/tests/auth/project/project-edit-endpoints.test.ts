import {
    AccessGroupEntity,
    MissionEntity,
    ProjectAccessEntity,
    ProjectEntity,
    TagTypeEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, DataType } from '@kleinkram/shared';
import {
    createMetadataUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { clearAllData, database } from '../../utils/database-utilities';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

globalThis.tagName = 'test_tag_STRING';

/**
 * This test suite tests the edit endpoint of project control of the application.
 * url: http://localhost:8003/projects --> edit project
 *
 */

describe('Verify project manipulation endpoints', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // global url set in utilities
        console.log(`[DEBUG]: Global url: ${DEFAULT_URL}`);

        // Create internal user
        ({
            user: globalThis.creator as UserEntity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.creator.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
        console.log(`[DEBUG]: Global creator: ${globalThis.creator.name}`);

        // Create 2nd internal user
        ({
            user: globalThis.user as UserEntity,
            token: globalThis.userToken,
            response: globalThis.userResponse,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
        console.log(`[DEBUG]: Global user: ${globalThis.user.name}`);
    });

    beforeEach(async () => {
        // get access group for creator
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.creator.name },
        });

        // get access group for user
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.user.name },
        });

        // create tag
        globalThis.metadataUuid = await createMetadataUsingPost(
            {
                type: DataType.STRING,
                name: globalThis.tagName,
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // check if it is generated
        const tagTypeRepository =
            database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagTypes = await tagTypeRepository.findOneOrFail({
            where: { uuid: globalThis.metadataUuid },
        });
        expect(await tagTypeRepository.count()).toBe(1);
        expect(tagTypes.uuid).toBe(globalThis.metadataUuid);
        expect(tagTypes.name).toBe(globalThis.tagName);

        // generate project with creator
        globalThis.projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [globalThis.metadataUuid],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                    {
                        rights: AccessGroupRights.READ,
                        accessGroupUUID: accessGroupUser.uuid,
                    },
                ],
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.creator,
        );

        // check if project is created
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const project = await projectRepository.findOneOrFail({
            where: { uuid: globalThis.projectUuid },
        });
        expect(project.name).toBe('test_project');
        expect(project.description).toBe('This is a test project');
        expect(project.uuid).toBe(globalThis.projectUuid);
    });

    afterEach(async () => {
        // check if users are still in the database
        const userRepository = database.getRepository<UserEntity>(UserEntity);
        const users = await userRepository.find();
        expect(users.length).toBe(2);

        // Ensure only the four users created in beforeAll are present
        const expectedUserUuids = [
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.creator.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.user.uuid,
        ];
        const actualUserUuids = users.map((user) => user.uuid);
        // eslint-disable-next-line unicorn/no-array-sort
        expect(actualUserUuids.sort()).toEqual(expectedUserUuids.sort());

        // delete all missions
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const allMissions = await missionRepository.find();
        const responseMission = await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
        console.log(`[DEBUG]: All Missions removed: ${responseMission}`);

        // delete project
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const allProjects = await projectRepository.find();
        const response = await projectRepository.remove(allProjects);
        const remainingProjects = await projectRepository.find();

        expect(remainingProjects.length).toBe(0);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
        console.log(`[DEBUG]: All Projects removed: ${response}`);

        // delete tags
        const tagsRepository =
            database.getRepository<TagTypeEntity>(TagTypeEntity);
        const allTagss = await tagsRepository.find();
        const metadataResponse = await tagsRepository.remove(allTagss);
        const remainingTags = await tagsRepository.find();

        expect(remainingTags.length).toBe(0);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
        console.log(`[DEBUG]: All Metadata removed: ${metadataResponse}`);
    });

    afterAll(async () => {
        await clearAllData();
        await database.destroy();
    });

    // metadata/access manipulation

    test('if metadata can be added to project by creator of project', async () => {
        // check if link between project and TagType is correct
        const TagTypeRepository =
            database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await TagTypeRepository.findOneOrFail({
            where: { uuid: globalThis.metadataUuid },
            relations: ['project'],
        });
        expect(tagType.name).toBe(globalThis.tagName);
        expect(tagType.uuid).toBe(globalThis.metadataUuid);
        expect(tagType.project?.[0]?.uuid).toBe(globalThis.projectUuid);
    });

    test('if project metadata can be added by creator of project', async () => {
        // create tag
        const name = 'second_test_tag_STRING';
        const metadataUuid = await createMetadataUsingPost(
            {
                type: DataType.STRING,
                name: name,
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            globalThis.user,
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headersBuilder = new HeaderCreator(globalThis.creator);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}/updateTagTypes`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify({
                    tagTypeUUIDs: [metadataUuid, globalThis.metadataUuid],
                }),
            },
        );

        const TagTypeRepository =
            database.getRepository<TagTypeEntity>(TagTypeEntity);
        const tagType = await TagTypeRepository.findOneOrFail({
            where: { uuid: metadataUuid },
            relations: ['project'],
        });
        expect(tagType.name).toBe(name);
        expect(tagType.uuid).toBe(metadataUuid);
        expect(tagType.project?.[0]?.uuid).toBe(globalThis.projectUuid);
        expect(response.status).toBeLessThan(300);
    });

    test('if access management of project can be edited by creator', async () => {
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.user.name },
        });
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.creator.name },
        });

        // check if access group has correct access to project
        const projectAccessRepository =
            database.getRepository<ProjectAccessEntity>(ProjectAccessEntity);
        const projectUserAccess = await projectAccessRepository.findOneOrFail({
            where: { accessGroup: { uuid: accessGroupUser.uuid } },
            relations: ['accessGroup'],
        });

        const projectCreatorAccess =
            await projectAccessRepository.findOneOrFail({
                where: { accessGroup: { uuid: accessGroupCreator.uuid } },
                relations: ['accessGroup'],
            });

        console.log('[DEBUG]: Access group USER:', accessGroupUser);
        console.log('[DEBUG]: Project access USER:', projectUserAccess);
        console.log('[DEBUG]: Access group CREATOR:', accessGroupCreator);
        console.log('[DEBUG]: Project access CREATOR:', projectCreatorAccess);

        expect(projectUserAccess.accessGroup?.uuid).toBe(accessGroupUser.uuid);
        expect(projectUserAccess.rights).toBe(AccessGroupRights.READ);

        expect(projectCreatorAccess.accessGroup?.uuid).toBe(
            accessGroupCreator.uuid,
        );
        expect(projectCreatorAccess.rights).toBe(AccessGroupRights.DELETE);

        // edit access rights for access group
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headersBuilder = new HeaderCreator(globalThis.creator);

        // check first if not all access groups with delete access can be deleted
        headersBuilder.addHeader('Content-Type', 'application/json');
        const failResponse = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}/access`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify([
                    {
                        memberCount: 2,
                        rights: AccessGroupRights.WRITE,
                        type: accessGroupCreator.type,
                        uuid: accessGroupCreator.uuid,
                        name: accessGroupCreator.name,
                    },
                ]),
            },
        );
        expect(failResponse.status).toBe(409);

        console.log('[DEBUG]: Access group creator:', accessGroupCreator);

        // change read access to write access
        const response = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}/access`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify([
                    {
                        memberCount: 2,
                        rights: AccessGroupRights.WRITE,
                        type: accessGroupUser.type,
                        uuid: accessGroupUser.uuid,
                        name: accessGroupUser.name,
                    },
                    {
                        memberCount: 1,
                        rights: AccessGroupRights.DELETE,
                        type: accessGroupCreator.type,
                        uuid: accessGroupCreator.uuid,
                        name: accessGroupCreator.name,
                    },
                ]),
            },
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const json = await response.json();
        console.log('[DEBUG]: Response status:', json);
        expect(response.status).toBe(201);

        const projectGroup = await projectAccessRepository.findOneOrFail({
            where: { accessGroup: { uuid: accessGroupUser.uuid } },
            relations: ['accessGroup'],
        });

        expect(projectGroup.accessGroup?.uuid).toBe(accessGroupUser.uuid);
        expect(projectGroup.rights).toBe(AccessGroupRights.WRITE);
    });
});
