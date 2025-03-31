import { clearAllData, db as database } from '../../utils/database-utilities';

import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
} from '../../../../common/frontend_shared/enum';

import AccessGroup from '../../../../common/entities/auth/accessgroup.entity';
import Project from '../../../../common/entities/project/project.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import {DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';
import User from '@common/entities/user/user.entity';
import { createAccessGroupUsingPost, createMetadataUsingPost, createProjectUsingPost, HeaderCreator } from 'tests/utils/api_calls';
import ProjectAccess from '@common/entities/auth/project-access.entity';

/**
 * This test suite tests the access control of the application.
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
            user: globalThis.creator as User, 
            token: globalThis.creator.token, 
            res: globalThis.creator.Response
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global creator: ${globalThis.creator.name}`);
        
        // Create 2nd internal user
        ({
            user: globalThis.user as User, 
            token: globalThis.userToken, 
            res: globalThis.userResponse
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global user: ${globalThis.user.name}`);
        
        // Create external user
        ({
            user: globalThis.externalUser as User, 
            token: globalThis.externalUser.token, 
            res: globalThis.externalUser.response
        } = await generateAndFetchDatabaseUser('external', 'user'));
        console.log(`[DEBUG]: Global external user: ${globalThis.externalUser.name}`);
        
        // Create admin user
        ({
            user: globalThis.admin as User, 
            token: globalThis.admin.token, 
            res: globalThis.admin.response
        } = await generateAndFetchDatabaseUser('internal', 'admin'));
        console.log(`[DEBUG]: Global admin: ${globalThis.admin.name}`);

    });

    beforeEach(async () => {
        // get access group for creator
        const accessGroupRepository = database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });

        // generate project with creator
        globalThis.projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            globalThis.creator
        );

        // check if project is created
        const projectRepository = database.getRepository<Project>('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: globalThis.projectUuid },
        });

        expect(project.name).toBe('test_project');
        expect(project.description).toBe('This is a test project');
        expect(project.uuid).toBe(globalThis.projectUuid);
    });

    afterEach(async () => {
        // check if users are still in the database
        const userRepository = database.getRepository<User>('User');
        const users = await userRepository.find();
        expect(users.length).toBe(4);
        
        // Ensure only the four users created in beforeAll are present
        const expectedUserUuids = [
            globalThis.creator.uuid,
            globalThis.user.uuid,
            globalThis.externalUser.uuid,
            globalThis.admin.uuid,
        ];
        const actualUserUuids = users.map(user => user.uuid);
        expect(actualUserUuids.sort()).toEqual(expectedUserUuids.sort());

        // delete all missions
        const missionRepository = database.getRepository('Mission');
        const allMissions = await missionRepository.find();
        const responseMission = await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        console.log(`[DEBUG]: All Missions removed: ${responseMission}`);

        // delete project
        const projectRepository = database.getRepository<Project>('Project');
        const allProjects = await projectRepository.find();
        const response = await projectRepository.remove(allProjects);
        const remainingProjects = await projectRepository.find();
        
        expect(remainingProjects.length).toBe(0);
        console.log(`[DEBUG]: All Projects removed: ${response}`);
    });

    afterAll(async () => {
        await clearAllData();
        await database.destroy();
    });

   // metadata/access manipulation

    test('if metadata can be added to project by creator of project', async () => {

        // create tag
        const tagUuid = await createMetadataUsingPost(
            {
                type: DataType.STRING,
                name: 'test_tag',
            },
            globalThis.creator,
        );

        const tagTypeRepository = database.getRepository('TagType');
        const tagTypes = await tagTypeRepository.find();
        expect(tagTypes.length).toBe(1);

        expect(tagTypes.length).toBe(1);
        expect(tagTypes[0]?.['uuid']).toBe(tagUuid);
        expect(tagTypes[0]?.['name']).toBe('test_tag');
        expect(tagTypes[0]?.['datatype']).toBe('STRING');

        // create project with tag as metadata
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [tagUuid],
            },
            globalThis.creator,
        );

        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(1);
        expect(projects[0][0]?.uuid).toBe(projectUuid);

        const tagRepository = database.getRepository<TagType>('TagType');
        const project_tags = await tagRepository.find({
            where: {uuid: tagUuid}
        }
        );

        console.log(
            '[DEBUG]: Tag uuid:',
            project_tags[0]?.uuid ?? 'No tags found.',
        );

        expect(project_tags.length).toBe(1);
        expect(project_tags[0]?.uuid).toBe(tagUuid);
    });

    test('if project metadata can be added by creator of project', async () => {
        const { user: user } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // create tag
        const tagUuid = await createMetadataUsingPost(
            {
                type: DataType.STRING,
                name: 'test_tag',
            },
            user,
        );

        const tagTypeRepository = database.getRepository<TagType>('TagType');
        const tagTypes = await tagTypeRepository.find();
        expect(tagTypes.length).toBe(1);

        expect(tagTypes.length).toBe(1);
        expect(tagTypes[0]?.['uuid']).toBe(tagUuid);
        expect(tagTypes[0]?.['name']).toBe('test_tag');
        expect(tagTypes[0]?.['datatype']).toBe('STRING');

        // create project with tag as metadata
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
            },
            user,
        );

        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(1);
        expect(projects[0][0]?.uuid).toBe(projectUuid);

        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const res = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/updateTagTypes`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify({ tagTypeUUIDs: [tagUuid] }),
            },
        );

        const projectTag = await tagTypeRepository.find({
            where: { uuid: tagUuid },
        });

        console.log('[DEBUG]: Created project tag:', projectTag);
        expect(projectTag[0]?.uuid).toBe(tagUuid);
        expect(res.status).toBeLessThan(300);
    });

    test('if access management of project can be edited by creator', async () => {
        // TODO: implement this test
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const { user: addedUser } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const rights = AccessGroupRights.READ;
        const groupName = 'test_access_group';

        // create access group
        const groupUuid = await createAccessGroupUsingPost(
            {
                name: groupName,
            },
            creator,
            [addedUser],
        );
        console.log('[DEBUG]: Group uuid:', groupUuid);

        // create project with new access right for access group
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: rights,
                        accessGroupUUID: groupUuid,
                    },
                ],
            },
            creator,
        );

        // check if project is created
        const projectRepository = database.getRepository<Project>('Project');
        const [projects, count] = await projectRepository.findAndCount();
        expect(count).toBe(1);
        expect(projects[0]?.uuid).toBe(projectUuid);

        // check if access group has access to project
        const projectAccessRepository =
            database.getRepository<ProjectAccess>('project_access');
        const projectAccess = await projectAccessRepository.findOneOrFail({
            where: { accessGroup: { uuid: groupUuid } },
            relations: ['accessGroup'],
        });
        console.log(
            '[DEBUG]: Project access group uuid:',
            projectAccess.accessGroup?.uuid,
        );
        console.log('[DEBUG]: Group uuid:', groupUuid);
        expect(projectAccess.accessGroup?.uuid).toBe(groupUuid);
        expect(projectAccess.rights).toBe(rights);

        // edit access rights for access group
        const headersBuilder = new HeaderCreator(creator);

        // check first if not all access groups with delete access can be deleted
        headersBuilder.addHeader('Content-Type', 'application/json');
        const res1 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/access`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify([
                    {
                        memberCount: 2,
                        rights: AccessGroupRights.WRITE,
                        type: AccessGroupType.CUSTOM,
                        uuid: groupUuid,
                    },
                ]),
            },
        );
        expect(res1.status).toBe(409);

        const accessGroupRepository =
            database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });

        console.log('[DEBUG]: Access group creator:', accessGroupCreator);

        // change read access to write access
        const res = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}/access`,
            {
                method: 'POST',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify([
                    {
                        memberCount: 2,
                        rights: AccessGroupRights.WRITE,
                        type: AccessGroupType.CUSTOM,
                        uuid: groupUuid,
                        name: groupName,
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
        const json = await res.json();
        console.log('[DEBUG]: Response status:', json);
        expect(res.status).toBe(201);

        const projectGroup = await projectAccessRepository.findOneOrFail({
            where: { accessGroup: { uuid: groupUuid } },
            relations: ['accessGroup'],
        });

        expect(projectGroup.accessGroup?.uuid).toBe(groupUuid);
        expect(projectGroup.rights).toBe(AccessGroupRights.WRITE);
    });

    test('if access management of project can be edited by users with edit or higher access', async () => {
        // TODO: implement this test

        expect(true).toBe(true);
    });
});