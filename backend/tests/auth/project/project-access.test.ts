import {
        clearAllData,
        db,
        getJwtToken,
        getUserFromDb,
        mockDbUser,
} from '../../utils/database_utils';

import {
        createProjectUsingPost,
        createMissionUsingPost
} from '../../utils/api_calls';

import {
    generateAndFetchDbUser,
} from '../utils';

import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
    } from '../../../../common/frontend_shared/enum';

import User from '../../../../common/entities/user/user.entity';

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Project Manipulation', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    // project creation/deleting tests
    test('if user with leggedrobotics email is allowed to create new project', async () => {
        const {user:user} = await generateAndFetchDbUser('internal', 'user');

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        expect(project['name']).toBe('test_project');
        expect(project['description']).toBe('This is a test project');
    });

    test('if user with leggedrobotics email have read only access by default', async () => {

        // generate project with internal user
        const {user:user1, res:res1} = await generateAndFetchDbUser('internal', 'user')
        expect(res1.status).toBe(200);

        const projectIuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user1,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectIuid },
        });
        expect(project['name']).toBe('test_project');

        // generate second internal user
        const {token: token2, res: res2 } = await generateAndFetchDbUser('internal', 'user');
        expect(res2.status).toBe(200);

        // const secondUserId = await mockDbUser('internal-2@leggedrobotics.com');
        // const secondUser = await getUserFromDb(secondUserId);

        // // check view access
        // const token = await getJwtToken(secondUser);

        // get project with user 2
        const res = await fetch(
            `http://localhost:3000/projects/${projectIuid}`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res.status).toBe(200);
        const projectRes = await res.json();
        expect(projectRes['name']).toBe('test_project');

        // check denied modification access with user2
        const res3 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectIuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${token2}`,
                },
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(res3.status).toBe(403);

        // check denied delete access
        const res4 = await fetch(
            `http://localhost:3000/projects/delete?uuid=${projectIuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res4.status).toBe(403);

        // assert that the project is not deleted
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
        expect(projects[0]?.['uuid']).toBe(projectIuid);
        expect(projects[0]?.['name']).toBe('test_project');
    });

    test('the creator of a project has delete access to the project', async () => {

        // generate internal user
        const {user:user1, token:token} = await generateAndFetchDbUser('internal', 'user')
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user1,
        );

        // check if project is created by reading the database
        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        expect(project['name']).toBe('test_project');

        // delete the project using the API
        // const token = await getJwtToken(user);
        const url = `http://localhost:3000/projects/${projectUuid}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                cookie: `authtoken=${token}`,
            },
        });
        expect(res.status).toBe(200);

        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('the creator of a project can add users to with read access to the project', async () => {

        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')
        const {user:user2, token:token2} = await generateAndFetchDbUser('internal', 'user')

        // create project with read access for user2
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.READ,
                        userUUID: user2.uuid,
                    },
                ],
            },
            user,
        );

        // check if project can be manipulated by user2
        const res = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${token2}`,
                },
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(res.status).toBe(403);

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res2.status).toBe(403);
    });

    test('the creator of a project can add users to with create access to the project', async () => {
        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')
        const {user:user2, token:token2} = await generateAndFetchDbUser('internal', 'user')

        // create project with read access for user2
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.CREATE,
                        userUUID: user2.uuid,
                    },
                ],
            },
            user,
        );

        // check if project can be manipulated by user2
        const res = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${token2}`,
                },
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(res.status).toBe(200);

        // create mission using the post by user2
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user2,
        );
        expect(missionUuid).toBeDefined();
        //TODO: check if mission is created

        
        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res2.status).toBe(403);
    });

    test('the creator of a project can add users to with write/modify access to the project', async () => {
        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')
        const {user:user2, token:token2} = await generateAndFetchDbUser('internal', 'user')

        // create project with write access for user2
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.WRITE,
                        userUUID: user2.uuid,
                    },
                ],
            },
            user,
        );

        // check if project can be manipulated by user2
        const res = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${token2}`,
                },
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(res.status).toBe(200);

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res2.status).toBe(403);
    });

    test('the creator of a project can add users to with delete access to the project', async () => {
        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')
        const {user:user2, token:token2} = await generateAndFetchDbUser('internal', 'user')

        // create project with delete access for user2
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        userUUID: user2.uuid,
                    },
                ],
            },
            user,
        );

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token2}`,
                },
            },
        );
        expect(res2.status).toBe(200);
    });

    test('if project can only be deleted if it has no missions', async () => {
        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')

        // create project with delete access for user
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                accessGroups: [
                    {
                        rights: AccessGroupRights.DELETE,
                        userUUID: user.uuid,
                    },
                ],
            },
            user,
        );

        // create mission using the post by user
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user,
        );
        expect(missionUuid).toBeDefined();

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );
        expect(res2.status).toBe(403);
    });
});

describe('Verify Project User Access', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });
    // access tests

        // admin
    test('if user with admin role can view any project', async () => {
        // generate 10 projects
        const projectRepository = db.getRepository('Project');
        const projectUuids: string[] = [];
        for (let i = 0; i < 10; i++) {
            const project = projectRepository.create();
            project['name'] = `Project ${i}`;
            project['description'] = `This is project ${i}`;
            const projectRes = await projectRepository.save(project);
            const projectUuid = projectRes['uuid'] as string;
            projectUuids.push(projectUuid);
        }

        // check if the projects are created
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);

        const { _, res } = await generateAndFetchDbUser('internal', 'admin');
        expect(res.status).toBe(200);

        const projectList = await res.json();
        console.log(projectList);
        expect(projectList[0].length).toBe(10);
        
        projectList[0]?.forEach((project: { uuid: string }) => {
            expect(projectUuids.includes(project.uuid)).toBe(true);
        });
    });

    test('if user with admin role can edit any project', async () => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if user with admin role can delete any project', async () => {
        const creatorUserId = await mockDbUser('creator@leggedrobotics.com');
        const userRepository = db.getRepository(User);
        const user = (await userRepository.findOne({
            where: { uuid: creatorUserId },
        })) as User;

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        let projects = await projectRepository.find();
        expect(projects.length).toBe(1);

        const adminUserId = await mockDbUser(
            'third-party-admin@test.com',
            undefined,
            UserRole.ADMIN,
        );
        const thirdPartyUser = (await userRepository.findOne({
            where: { uuid: adminUserId },
        })) as User;
        const thirdPartyToken = getJwtToken(thirdPartyUser);

        const res = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${thirdPartyToken}`,
                },
            },
        );
        expect(res.status).toBe(200);

        projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

        // external
    test('third party user cannot view any project by default', async () => {
        // const interalUserId = await mockDbUser(
        //     'some-interal-user@leggedrobotics.com',
        // );
        // const internalUser = await getUserFromDb(interalUserId);

        // generate project with internal user
        
        const {res: res1 } = await generateAndFetchDbUser('internal', 'user');
        expect(res1.status).toBe(200);

        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            internalUser,
        );

        const projectRepository = db.getRepository('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);

        const { token:externalUserToken ,res: res2 } = await generateAndFetchDbUser('external', 'user');
        // const externalUserId = await mockDbUser(
        //     'some-external-user@third-party.com',
        // );
        // const externalUser = await getUserFromDb(externalUserId);
        // const externalUserToken = await getJwtToken(externalUser);

        // // check single project view access
        // const res2 = await fetch(
        //     `http://localhost:3000/projects/${projectUuid}`,
        //     {
        //         method: 'GET',
        //         headers: {
        //             cookie: `authtoken=${externalUserToken}`,
        //         },
        //     },
        // );
        
        expect(res2.status).toBe(403);

        // check list of projects view access
        const res = await fetch(
            `http://localhost:3000/oldProject/filtered?take=10&skip=0&sortBy=name&descending=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${externalUserToken}`,
                },
            },
        );
        expect(res.status).toBe(200);
        const projectList = await res.json();
        expect(projectList[0].length).toBe(0);
    });

    test('if external user cannot create a new project', async () => {
        const mockEmail = 'some-external@ethz.ch';
        const externalUuid = await mockDbUser(mockEmail);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: externalUuid },
        });

        const projectRepository = db.getRepository('Project');
        const project = projectRepository.create();
        project['name'] = 'test_project';
        project['description'] = 'This is a test project';

        const token = await getJwtToken(user);
        const res = await fetch(`http://localhost:3000/projects`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,

                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: project['name'],
                description: project['description'],
                requiredTags: [],
            }),
        });

        expect(res.status).toBe(403);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if external user cannot delete any project', async () => {
        const mockEmail = 'some-external@ethz.ch';
        const externalUuid = await mockDbUser(mockEmail);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: externalUuid },
        });

        const projectRepository = db.getRepository('Project');
        const project = projectRepository.create();
        project['name'] = 'test_project';
        project['description'] = 'This is a test project';
        const projectRes = await projectRepository.save(project);

        const token = await getJwtToken(user);
        const res = await fetch(
            `http://localhost:3000/projects/${projectRes['uuid']}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );

        expect(res.status).toBe(403);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });


    // projects tab endpoints

    test('if project can only be edited by users with edit access', async () => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if project tags can only be configured by users with edit or higher access', async () => {
        // TODO: implement this test

        expect(true).toBe(true);
    });

    test('if project access can only be managed by users with edit or higher access', async () => {
        // TODO: implement this test

        expect(true).toBe(true);
    });
    
    test('if project can only be deleted by users with delete access', async () => {
        const mockEmail = 'some-external@ethz.ch';
        const externalUuid = await mockDbUser(mockEmail);

        const userRepository = db.getRepository(User);
        const externalUser = await userRepository.findOneOrFail({
            where: { uuid: externalUuid },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const projectRepository = db.getRepository('Project');
        const project = projectRepository.create();

        project['name'] = 'test_project';
        project['description'] = 'This is a test project';
        const projectRes = await projectRepository.save(project);

        // delete the project using the external user
        const tokenExternal = getJwtToken(externalUser);
        const deleteRequest = {
            method: 'DELETE',
            headers: {
                cookie: `authtoken=${tokenExternal}`,
            },
        };

        const res = await fetch(
            `http://localhost:3000/projects/${projectRes['uuid']}`,
            deleteRequest,
        );
        expect(res.status).toBe(403);

        if (project['project_accesses'] === undefined) {
            throw new Error('Project access not set');
        }

        project['project_accesses'] = [
            {
                rights: AccessGroupRights.DELETE,
                accessGroup: externalUser?.memberships?.find(
                    (group) =>
                        group?.accessGroup?.type === AccessGroupType.PRIMARY,
                )?.accessGroup?.uuid,
            },
        ];
        await projectRepository.save(project);

        const res2 = await fetch(
            `http://localhost:3000/projects/${projectRes['uuid']}`,
            deleteRequest,
        );
        expect(res2.status).toBe(200);
    });
});

describe('Verify Project Groups Access', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
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