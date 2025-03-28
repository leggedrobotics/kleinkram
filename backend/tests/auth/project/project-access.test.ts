import { clearAllData, db as database } from '../../utils/database-utilities';

import {
    createProjectUsingPost,
    HeaderCreator,
    createMetadataUsingPost,
    createAccessGroupUsingPost,
    createMissionUsingPost,
} from '../../utils/api_calls';

import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
} from '../../../../common/frontend_shared/enum';

import AccessGroup from '../../../../common/entities/auth/accessgroup.entity';
import Project from '../../../../common/entities/project/project.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import User from '@common/entities/user/user.entity';
import {DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * This test suite tests the access control of the application.
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
            res: globalThis.creator.Response
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        
        // Create 2nd internal user
        ({
            user: globalThis.user as User, 
            token: globalThis.userToken, 
            res: globalThis.userResponse
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        
        // Create external user
        ({
            user: globalThis.externalUser as User, 
            token: globalThis.externalUser.token, 
            res: globalThis.externalUser.response
        } = await generateAndFetchDatabaseUser('external', 'user'));
        
        // Create admin user
        ({
            user: globalThis.admin as User, 
            token: globalThis.admin.token, 
            res: globalThis.admin.response
        } = await generateAndFetchDatabaseUser('internal', 'admin'));


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
        const header = new HeaderCreator(globalThis.creator, undefined);
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
        const header = new HeaderCreator(globalThis.user,  undefined);
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
        const headerCreator = new HeaderCreator(globalThis.creator, undefined);
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
        const headerCreator = new HeaderCreator(globalThis.user, undefined);
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

        // create project with edit access for user
        console.log(`[DEBUG]: Creator UUID: ${globalThis.creator.uuid}`);
        console.log(`[DEBUG]: User UUID: ${globalThis.user.uuid}`);

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

        const headerCreator = new HeaderCreator(undefined, globalThis.userToken);
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


        const headersBuilder = new HeaderCreator(globalThis.user, undefined);
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
        const creatorHeader = new HeaderCreator(globalThis.creator, undefined);
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
        const userHeader = new HeaderCreator(globalThis.user, undefined);
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
        const headerCreator = new HeaderCreator(globalThis.user, undefined);
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
        const creatorHeader = new HeaderCreator(globalThis.creator, undefined);
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

describe('Verify Project User Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);

    afterAll(async () => {
        await database.destroy();
    });

    // access tests

    // admin
    test('if user with admin role can view any project', async () => {
        const { user: user } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );
        const projectRepository = database.getRepository<Project>('Project');

        const projectUuids = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${index + 1}`,
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,
                    }),
                );
                return project['uuid']; // Corrected property access
            }),
        );

        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);

        const { res: res, token: admin_token } =
            await generateAndFetchDatabaseUser('internal', 'admin');
        expect(res.status).toBe(200);

        for (const [index, uuid] of projectUuids.entries()) {
            // Check read accesss
            const headerCreator = new HeaderCreator(undefined, admin_token);
            const res = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            });

            expect(res.status).toBe(200);

            const projectRes = await res.json();
            expect(projectRes['name']).toBe(`test_project${index + 1}`);
        }
    });

    test('if user with admin role can edit any project', async () => {
        // TODO check if preserving the database makes sense
        const { user: user } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const projectRepository = database.getRepository<Project>('Project');

        const projectUuids = await Promise.all(
            Array.from({ length: 5 }, async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${index + 1}`,
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,
                    }),
                );
                return project['uuid'];
            }),
        );
        const projects = await projectRepository.find();
        expect(projects.length).toBe(5);

        const { token: admin_token, res: res } =
            await generateAndFetchDatabaseUser('internal', 'admin');

        for (const [index, uuid] of projectUuids.entries()) {
            // Check read access
            const headerCreator = new HeaderCreator(undefined, admin_token);
            headerCreator.addHeader('Content-Type', 'application/json');
            const res = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: `newName${index}`,
                    description: `decription${index}`,
                    autoConvert: false,
                }),
            });

            expect(res.status).toBe(200);

            const projectRes = await res.json();
            expect(projectRes['name']).toBe(`newName${index}`);
        }
    });

    test('if user with admin role can delete any project', async () => {
        // TODO check if preserving the database makes sense
        const { user: user } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const projectRepository = database.getRepository<Project>('Project');

        const projectUuids = await Promise.all(
            Array.from({ length: 5 }, async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${index + 1}`,
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,
                    }),
                );
                return project['uuid'];
            }),
        );

        const projects1 = await projectRepository.find();
        expect(projects1.length).toBe(5);

        const { token: admin_token } = await generateAndFetchDatabaseUser(
            'internal',
            'admin',
        );

        for (const [index, uuid] of projectUuids.entries()) {
            // Check read access
            const headerCreator = new HeaderCreator(undefined, admin_token);
            headerCreator.addHeader('Content-Type', 'application/json');
            const res = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            });

            expect(res.status).toBe(200);
        }

        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    // external
    test('third party user cannot view any project by default', async () => {
        // TODO check if preserving the database makes sense
        const { user: user, token: token } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        const { token: externaltoken } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const projectRepository = database.getRepository<Project>('Project');
        const membershipRepository = database.getRepository('group_membership');
        const projectAccessRepository =
            database.getRepository('project_access');

        const numberOfProjects = 10;
        console.log(`[DEBUG]: Generate ${numberOfProjects} test projects.`);

        const projectUuids = await Promise.all(
            Array.from({ length: numberOfProjects }).map(async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${index + 1}`,
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,
                    }),
                );
                return project['uuid'];
            }),
        );

        // get accessGroupUuid for userUuid in group membership'

        console.log(`[DEBUG]: Generate project access for internal user.`);
        const accessGroups = await membershipRepository.find({
            where: { user: { uuid: user.uuid } },
            relations: ['accessGroup'],
        });

        for (const group in accessGroups) {
            if (!group['accessGroup']) {
                console.error(
                    'Error: accessGroup is undefined for group:',
                    group,
                );
                return; // Skip this iteration
            }

            const accessGroupUuid = group['accessGroup']['uuid'];

            (async () => {
                for (const uuid of projectUuids) {
                    await projectAccessRepository.save(
                        projectAccessRepository.create({
                            accessGroup: accessGroupUuid,
                            project: uuid,
                            rights: 10,
                        }),
                    );
                }
            })();
        }

        // check if projects are generated
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(numberOfProjects);

        // try to get all projects with internal user
        const headerCreator = new HeaderCreator(undefined, token);
        headerCreator.addHeader('Content-Type', 'application/json');

        const res = await fetch(
            `${DEFAULT_URL}/oldProject/filtered?take=20&skip=0&sortBy=name&sortDirection=ASC`,
            {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            },
        );

        expect(res.status).toBe(200);
        const projectList = await res.json();
        console.log('projectList', projectList);
        expect(projectList.data.length).toBe(numberOfProjects);

        // check single project view access
        const headerCreator1 = new HeaderCreator(undefined, externaltoken);
        headerCreator1.addHeader('Content-Type', 'application/json');
        const res1 = await fetch(
            `${DEFAULT_URL}/projects/${projectUuids[0]}`,
            {
                method: 'GET',
                headers: headerCreator1.getHeaders(),
            },
        );

        expect(res1.status).toBe(403);

        // check list of projects view access
        const res2 = await fetch(
            `${DEFAULT_URL}/oldProject/filtered?take=20&skip=0&sortBy=name&sortDirection=ASC`,
            {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            },
        );

        expect(res2.status).toBe(200);
        const projectList1 = await res2.json();
        expect(Array.isArray(projectList1.data)).toBe(true);
        expect(projectList1.data.length).toBe(0);
    });

    test('if external user cannot create a new project', async () => {
        const { user: externalUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        const headersBuilder = new HeaderCreator(externalUser);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const res = await fetch(`${DEFAULT_URL}/project`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                name: 'external_project',
                description: 'Description of external_project',
            }),
            credentials: 'include',
        });

        // check if the request was successful
        expect(res.status).toBe(403);

        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(0);
    });

    test('if external user cannot delete any project', async () => {
        const { token: externalToken } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );
        const { user: user } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // create project with delete access for user
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

        const headerCreator = new HeaderCreator(undefined, externalToken);
        headerCreator.addHeader('Content-Type', 'application/json');
        const res = await fetch(
            `${DEFAULT_URL}/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            },
        );

        expect(res.status).toBe(403);
        const projects2 = await projectRepository.find();
        expect(projects2.length).toBe(1);
    });

    // projects tab endpoints

    // metadata/access manipulation

    test('if metadata can be added to project by creator of project', async () => {
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
            user,
        );

        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(1);
        expect(projects[0][0]?.uuid).toBe(projectUuid);

        const tagRepository = database.getRepository<TagType>('TagType');
        const project_tags = await tagRepository.find();

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

describe('Verify Project Groups Access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    // access Group Tests
    test('if user can add project with read access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with create access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with write access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add project with delete access to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with read rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with create rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with write rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });

    test('if user can add multiple projects with delete rights to existing access group', async () => {
        // TODO: implement this test
        expect(true).toBe(true);
    });
});
