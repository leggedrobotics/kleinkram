import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import UserEntity from '@common/entities/user/user.entity';
import { AccessGroupRights } from '@common/frontend_shared/enum';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../../utils/api-calls';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * This test suite tests the project endpoints of the application.
 * url: http://localhost:8003/projects
 *
 */

describe('Verification project endpoint', () => {
    setupDatabaseHooks();

    let creator: UserEntity;
    let user: UserEntity;
    let externalUser: UserEntity;
    let admin: UserEntity;
    let projectUuid: string;

    beforeEach(async () => {
        // global url set in utilities
        // global url set in utilities

        // Create internal user
        const creatorData = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        creator = creatorData.user;
        creator = creatorData.user;

        // Create 2nd internal user
        const userData = await generateAndFetchDatabaseUser('internal', 'user');
        user = userData.user;
        user = userData.user;

        // Create external user
        const externalUserData = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        externalUser = externalUserData.user;
        externalUser = externalUserData.user;

        // Create admin user
        const adminData = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );
        admin = adminData.user;
        admin = adminData.user;
        // get access group for creator
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });

        // generate project with creator
        projectUuid = await createProjectUsingPost(
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
            creator,
        );

        // check if project is created
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });

        expect(project.name).toBe('test_project');
        expect(project.description).toBe('This is a test project');
        expect(project.uuid).toBe(projectUuid);
    });

    afterEach(async () => {
        // check if users are still in the database
        const userRepository = database.getRepository<UserEntity>(UserEntity);
        const users = await userRepository.find();
        expect(users.length).toBe(4);

        // Ensure only the four users created in beforeAll are present
        const expectedUserUuids = [
            creator.uuid,
            user.uuid,
            externalUser.uuid,
            admin.uuid,
        ];
        const actualUserUuids = users.map((user) => user.uuid);
        expect(actualUserUuids.sort()).toEqual(expectedUserUuids.sort());

        // delete all missions
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const allMissions = await missionRepository.find();
        const responseMission = await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        expect(remainingMissions.length).toBe(0);

        // delete project
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const allProjects = await projectRepository.find();
        const response = await projectRepository.remove(allProjects);
        const remainingProjects = await projectRepository.find();

        expect(remainingProjects.length).toBe(0);
        expect(remainingProjects.length).toBe(0);
    });

    // afterAll handled by setupDatabaseHooks

    test('User with leggedrobotics email can create a new project', async () => {
        // happens in beforeAll
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        expect(project['name']).toBe('test_project');
    });

    test('if it is not possible to create a project with the same name', async () => {
        const header = new HeaderCreator(creator);
        const response = await fetch(`${DEFAULT_URL}/projects`, {
            method: 'POST',
            headers: header.getHeaders(),
            body: JSON.stringify({
                name: 'test_project',
                description: 'This is a test project',
            }),
        });
        expect(response.status).toBe(400);
    });

    test('if user with leggedrobotics email have read only access by default', async () => {
        // get project with user 2
        const header = new HeaderCreator(user);
        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'GET',
            headers: header.getHeaders(),
        });
        expect(response.status).toBe(200);
        const projectResponse = await response.json();
        expect(projectResponse['name']).toBe('test_project');

        // check denied modification access with user2
        header.addHeader('Content-Type', 'application/json');
        const response2 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
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
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: header.getHeaders(),
            },
        );
        expect(response3.status).toBe(403);

        // check database
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        expect(project['name']).toBe('test_project');
        expect(project['uuid']).toBe(projectUuid);

        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });

    test('the creator of a project has delete access to the project', async () => {
        // delete the project
        const headerCreator = new HeaderCreator(creator);
        const url = `${DEFAULT_URL}/projects/${projectUuid}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: headerCreator.getHeaders(),
        });
        expect(response.status).toBe(200);

        // check if project is deleted
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
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
                        userUUID: user.uuid,
                    },
                ],
            },
            creator,
        );

        // check if project can be manipulated by user2
        const headerCreator = new HeaderCreator(user);
        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'PUT',
            headers: headerCreator.getHeaders(),
            body: JSON.stringify({
                name: '1234',
                description: '1234',
                requiredTags: [],
            }),
        });
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
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: user.name },
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
            creator,
        );

        const headerCreator = new HeaderCreator(user);
        headerCreator.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
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
        });
        expect(response.status).toBe(200);

        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');

        // check if project can be deleted by user
        const response2 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
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
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: user.name },
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
            creator,
        );

        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );

        // check if mission is generated
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const mission = await missionRepository.findOneOrFail({
            where: { uuid: missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        expect(missions.length).toBe(1);

        // denied permission to delete project because of mission
        const creatorHeader = new HeaderCreator(creator);
        creatorHeader.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
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
        });
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
        expect(remainingMissions.length).toBe(0);

        // check if project can not be deleted by user
        const userHeader = new HeaderCreator(user);
        userHeader.addHeader('Content-Type', 'application/json');
        const response2 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
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
        const headerCreator = new HeaderCreator(user);
        headerCreator.addHeader('Content-Type', 'application/json');

        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: user.name },
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
            creator,
        );

        // check if project can be deleted by user
        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'DELETE',
            headers: headerCreator.getHeaders(),
        });
        expect(response.status).toBe(200);
    });

    test('if project can only be deleted if it has no missions', async () => {
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            creator,
        );

        // check if mission is generated
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const mission = await missionRepository.findOneOrFail({
            where: { uuid: missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        expect(missions.length).toBe(1);

        // denied permission to delete project because of mission
        const creatorHeader = new HeaderCreator(creator);
        creatorHeader.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/projects/${projectUuid}`, {
            method: 'DELETE',
            headers: creatorHeader.getHeaders(),
            body: JSON.stringify({
                name: '1234',
                description: '1234',
                requiredTags: [],
            }),
        });
        expect(response.status).toBe(409);

        // check if project is not deleted
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });
});
