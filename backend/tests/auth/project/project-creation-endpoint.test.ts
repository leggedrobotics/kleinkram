import { clearAllData, database } from '../../utils/database-utilities';

import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';

import {
    AccessGroupRights
} from '../../../../common/frontend_shared/enum';

import User from '@common/entities/user/user.entity';
import AccessGroup from '../../../../common/entities/auth/accessgroup.entity';
import Project from '../../../../common/entities/project/project.entity';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * This test suite tests the project endpoints of the application.
 * url: http://localhost:8003/projects
 *
 */

describe('Verification project endpoint', () => {

    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // global url set in utilities
        console.log(`[DEBUG]: Global url: ${DEFAULT_URL}`);

        // Create internal user
        ({
            user: globalThis.creator as User, 
            token: globalThis.creator.token, 
            response: globalThis.creator.Response
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global creator: ${globalThis.creator.name}`);
        
        // Create 2nd internal user
        ({
            user: globalThis.user as User, 
            token: globalThis.userToken, 
            response: globalThis.userResponse
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global user: ${globalThis.user.name}`);
        
        // Create external user
        ({
            user: globalThis.externalUser as User, 
            token: globalThis.externalUser.token, 
            response: globalThis.externalUser.response
        } = await generateAndFetchDatabaseUser('external', 'user'));
        console.log(`[DEBUG]: Global external user: ${globalThis.externalUser.name}`);
        
        // Create admin user
        ({
            user: globalThis.admin as User, 
            token: globalThis.admin.token, 
            response: globalThis.admin.response
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

    test('User with leggedrobotics email can create a new project', async () => {

        // happens in beforeAll
        const projectRepository = database.getRepository<Project>('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: globalThis.projectUuid },
        });
        expect(project['name']).toBe('test_project');
    });

    test('if it is not possible to create a project with the same name', async () => {
        const header = new HeaderCreator(globalThis.creator);
        const response = await fetch(
            `${DEFAULT_URL}/project`,
            {
                method: 'POST',
                headers: header.getHeaders(),
                body: JSON.stringify({
                    name: 'test_project',
                    description: 'This is a test project',
                }),
            },
        );
        expect(response.status).toBe(400);
    });

    test('if user with leggedrobotics email have read only access by default', async () => {
        
        // get project with user 2
        const header = new HeaderCreator(globalThis.user);
        const response = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}`,
            {
                method: 'GET',
                headers: header.getHeaders(),
            },
        );
        expect(response.status).toBe(200);
        const projectResponse = await response.json();
        expect(projectResponse['name']).toBe('test_project');

        // check denied modification access with user2
        header.addHeader('Content-Type', 'application/json');
        const response2 = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}`,
            {
                method: 'PUT',
                headers: header.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    autoConvert: false,
                }),
            },
        );
        expect(response2.status).toBe(403);

        // check denied delete access
        const response3 = await fetch(
            `${DEFAULT_URL}/projects/${globalThis.projectUuid}`,
            {
                method: 'DELETE',
                headers: header.getHeaders(),
            },
        );
        expect(response3.status).toBe(403);

        // check database
        const projectRepository = database.getRepository<Project>('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: globalThis.projectUuid },
        });
        expect(project['name']).toBe('test_project');
        expect(project['uuid']).toBe(globalThis.projectUuid);

        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });

    test('the creator of a project has delete access to the project', async () => {

        // delete the project
        const headerCreator = new HeaderCreator(globalThis.creator);
        const url = `${DEFAULT_URL}/projects/${globalThis.projectUuid}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: headerCreator.getHeaders(),
        });
        expect(response.status).toBe(200);

        // check if project is deleted
        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('the creator can add users to with READ access to the project during creation', async () => {

        // create project with read access for user2
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project_2',
                description: 'This is a second test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUUID: globalThis.user.uuid,
                    },
                ],
            },
            globalThis.creator,
        );

        // check if project can be manipulated by user2
        const headerCreator = new HeaderCreator(globalThis.user);
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(response.status).toBe(403);

        // check if project can be deleted by user2
        const response2 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            },
        );
        expect(response2.status).toBe(403);
    });

    test('the creator can add users to with WRITE access to the project during creation', async () => {

        const accessGroupRepository = database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project_2',
                description: 'This is a second test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        accessGroupUUID: accessGroupUser.uuid,
                    },
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            globalThis.creator,
        );

        const headerCreator = new HeaderCreator(globalThis.user);
        headerCreator.addHeader('Content-Type', 'application/json');
        
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                    accessGroups: [
                        {
                            rights: AccessGroupRights.WRITE,
                            accessGroupUUID: accessGroupUser.uuid,
                        },
                        {
                            rights: AccessGroupRights.DELETE,
                            accessGroupUUID: accessGroupCreator.uuid,
                        },
                    ],
                }),
            },
        );
        expect(response.status).toBe(200);


        const headersBuilder = new HeaderCreator(globalThis.user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        // check if project can be deleted by user
        const response2 = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headersBuilder.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                    accessGroups: [
                        {
                            rights: AccessGroupRights.WRITE,
                            accessGroupUUID: accessGroupUser.uuid,
                        },
                        {
                            rights: AccessGroupRights.DELETE,
                            accessGroupUUID: accessGroupCreator.uuid,
                        },
                    ],
                }),
            },
        );
        expect(response2.status).toBe(403);
    });

    test('the creator can add users to with CREATE access to the project during creation', async () => {

        // create project with CREATE access for user
        const accessGroupRepository = database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project_2',
                description: 'This is a second test project',
                requiredTags: [],
                accessGroups: [
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: accessGroupUser.uuid,
                    },
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupCreator.uuid,
                    },
                ],
            },
            globalThis.creator,
        );

       const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            globalThis.user,
        );

        // check if mission is generated
        const missionRepository = database.getRepository('Mission');
        const mission = await missionRepository.findOneOrFail({
            where: { uuid: missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        console.log(`[DEBUG]: Mission created with UUID: ${missionUuid}`);

        // denied permission to delete project because of mission
        const creatorHeader = new HeaderCreator(globalThis.creator);
        creatorHeader.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: creatorHeader.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                    accessGroups: [
                        {
                            rights: AccessGroupRights.WRITE,
                            accessGroupUUID: accessGroupUser.uuid,
                        },
                        {
                            rights: AccessGroupRights.DELETE,
                            accessGroupUUID: accessGroupCreator.uuid,
                        },
                    ],
                }),
            },
        );
        expect(response.status).toBe(409);

        // delete mission
        const deleteMissionResponse = await fetch(
            `${DEFAULT_URL}/mission/${missionUuid}`,
            {
            method: 'DELETE',
            headers: creatorHeader.getHeaders(),
            },
        );
        expect(deleteMissionResponse.status).toBe(200);

        // verify mission is deleted
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        console.log(`[DEBUG]: Mission deleted with UUID ${missionUuid}`);

        // check if project can not be deleted by user
        const userHeader = new HeaderCreator(globalThis.user);
        userHeader.addHeader('Content-Type', 'application/json');
        const response2 = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: userHeader.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                    accessGroups: [
                        {
                            rights: AccessGroupRights.WRITE,
                            accessGroupUUID: accessGroupUser.uuid,
                        },
                        {
                            rights: AccessGroupRights.DELETE,
                            accessGroupUUID: accessGroupCreator.uuid,
                        },
                    ],
                }),
            },
        );
        expect(response2.status).toBe(403);
    });

    test('the creator can add users to with DELETE access to the project during creation', async () => {

        // create project with delete access for user2
        const headerCreator = new HeaderCreator(globalThis.user);
        headerCreator.addHeader('Content-Type', 'application/json');

        const accessGroupRepository = database.getRepository<AccessGroup>('access_group');
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
        });

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project_2',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        accessGroupUUID: accessGroupUser.uuid,
                    },
                ],
            },
            globalThis.creator,
        );

        // check if project can be deleted by user
        const response = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            },
        );
        expect(response.status).toBe(200);
    });

    test('if project can only be deleted if it has no missions', async () => {
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: globalThis.projectUuid,
                tags: {},
                ignoreTags: true,
            },
            globalThis.creator,
        );

        // check if mission is generated
        const missionRepository = database.getRepository('Mission');
        const mission = await missionRepository.findOneOrFail({
            where: { uuid: missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        console.log(`[DEBUG]: Mission created with UUID: ${missionUuid}`);

        // denied permission to delete project because of mission
        const creatorHeader = new HeaderCreator(globalThis.creator);
        creatorHeader.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/projects/${globalThis.projectUuid}`,
            {
                method: 'DELETE',
                headers: creatorHeader.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(response.status).toBe(409);

        // check if project is not deleted
        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });
});