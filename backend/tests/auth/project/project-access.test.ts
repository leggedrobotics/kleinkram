import {
        clearAllData,
        db,
        getJwtToken,
        getUserFromDb,
        mockDbUser,
} from '../../utils/database_utils';

import {
        createProjectUsingPost,
        createMissionUsingPost,
        HeaderCreator
} from '../../utils/api_calls';

import {
    generateAndFetchDbUser,
    getAccessGroupForEmail,
    getAllAccessGroups,
} from '../utils';

import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
    } from '../../../../common/frontend_shared/enum';

import User from '../../../../common/entities/user/user.entity';
import { MissionService } from '../../../src/services/mission.service';
import AccessGroup from '../../../../common/entities/auth/accessgroup.entity';
import { ConsoleLogger } from '@nestjs/common';


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
        await clearAllData();
        await db.destroy();
    });

    // project creation/deleting tests
    test('if user with leggedrobotics email is allowed to create new project', async () => {

        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user');
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

        // generate first project with internal user
        const {user:user1} = await generateAndFetchDbUser('internal', 'user')
        const projectUuid = await createProjectUsingPost(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user1,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        expect(project['name']).toBe('test_project');

        // generate second internal user
        const {token: token2} = await generateAndFetchDbUser('internal', 'user');

        // get project with user 2 
        const headerCreator2 = new HeaderCreator(undefined, token2);
        const res = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'GET',
                headers: headerCreator2.getHeaders(),
            },
        );
        expect(res.status).toBe(200);
        const projectRes = await res.json();
        expect(projectRes['name']).toBe('test_project');


        // check denied modification access with user2
        headerCreator2.addHeader('Content-Type', 'application/json');
        const res3 = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'PUT',
                headers: headerCreator2.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    autoConvert: false
                }),
            },
        );
        expect(res3.status).toBe(403);

        // check denied delete access
        const res4 = await fetch(
            `http://localhost:3000/projects/delete?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator2.getHeaders(),
            },
        );
        expect(res4.status).toBe(403);

        // assert that the project is not deleted
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
        expect(projects[0]?.['uuid']).toBe(projectUuid);
        expect(projects[0]?.['name']).toBe('test_project');
    });

    test('the creator of a project has delete access to the project', async () => {

        // generate internal user
        const {user:user1, token:token1} = await generateAndFetchDbUser('internal', 'user')
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

        // delete the project
        const headerCreator = new HeaderCreator(undefined, token1);
        const url = `http://localhost:3000/projects/${projectUuid}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: headerCreator.getHeaders(),
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

        const headerCreator = new HeaderCreator(undefined, token2);
        // check if project can be manipulated by user2
        const res = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
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
        expect(res.status).toBe(403);

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders()
            },
        );
        expect(res2.status).toBe(403);
    });

    test('the creator of a project can add users to with create access to the project', async () => {
        // create two internal users
        const {user:user} = await generateAndFetchDbUser('internal', 'user')
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

        // check if project can not be manipulated by user2
        const headerCreator = new HeaderCreator(undefined, token2);
        const res = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
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
        expect(res.status).toBe(403);

        // check if mission can be created by user2
        const missionUuid = await createMissionUsingPost(
            {
                name: 'test_mission',
                projectUUID: projectUuid,
                tags: {},
                ignoreTags: true,
            },
            user2,
        );

        // check if mission is generated
        const missionRepository = db.getRepository('Mission');
        const mission = await missionRepository.findOneOrFail({
            where: { uuid: missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        
        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/update?uuid=${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders()
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

        // check if project can not be manipulated by user2
        const headerCreator = new HeaderCreator(undefined, token2);
        headerCreator.addHeader('Content-Type', 'application/json')
        const res = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    autoConvert: false
                }),
            },
        );
        expect(res.status).toBe(200);

        // check if project can be deleted by user2
        const res2 = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            },
        );
        expect(res2.status).toBe(403);
    });

    test('the creator of a project can add users to with delete access to the project', async () => {
        // create two internal users
        const {user:user, token:token} = await generateAndFetchDbUser('internal', 'user')
        const {user:user2, token:token2} = await generateAndFetchDbUser('internal', 'user')

        // create project with delete access for user2
        const headerCreator = new HeaderCreator(undefined, token2);
        headerCreator.addHeader('Content-Type', 'application/json')

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
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
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
        const headerCreator = new HeaderCreator(undefined, token);
        headerCreator.addHeader('Content-Type', 'application/json')

        const res2 = await fetch(
            `http://localhost:3000/projects/${projectUuid}`,
            {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            },
        );

        // TODO: check with Cyril if it should be 409 or 403
        expect(res2.status).toBe(409);

        // check if project is not deleted
        const projectRepository = db.getRepository('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
    });
});


describe('Verify Project User Access', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);

    // afterAll(async () => {
    //     await db.destroy();
    // });

    // access tests

        // admin
    test('if user with admin role can view any project', async () => {
        const {user:user} = await generateAndFetchDbUser('internal', 'user');
        const projectRepository = db.getRepository('Project');
        const projectUuids = await Promise.all(
            Array.from({ length: 10 }, async (_, i) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${i + 1}`,
                        description: `This is a test project ${i + 1}`,
                        autoConvert: false
                    })
                );
                return project['uuid']; // Corrected property access
            })
        );
        
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);

        const { res:res, token:admin_token } = await generateAndFetchDbUser('internal', 'admin');
        expect(res.status).toBe(200);

        for (const [i, uuid] of projectUuids.entries()) {
            // Check read accesss
            const headerCreator = new HeaderCreator(undefined, admin_token);
            const res = await fetch(
                `http://localhost:3000/projects/${uuid}`,
                {
                    method: 'GET',
                    headers: headerCreator.getHeaders(),
                }
            );
        
            expect(res.status).toBe(200);
            
            const projectRes = await res.json();
            expect(projectRes['name']).toBe(`test_project${i + 1}`);
        }
    });

    test('if user with admin role can edit any project', async () => {

        // TODO check if preserving the database makes sense
        const {user:user} = await generateAndFetchDbUser('internal', 'user');

        const projectRepository = db.getRepository('Project');

        const projectUuids = await Promise.all(
            Array.from({ length: 5 }, async (_, i) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${i + 1}`,
                        description: `This is a test project ${i + 1}`,
                        autoConvert: false
                    })
                );
                return project['uuid'];
            })
        );
        
        const projects = await projectRepository.find();
        expect(projects.length).toBe(5);

        const {token:admin_token, res:res } = await generateAndFetchDbUser('internal', 'admin');
        
        for (const [i, uuid] of projectUuids.entries()) {
            // Check read access
            const headerCreator = new HeaderCreator(undefined, admin_token);
            headerCreator.addHeader('Content-Type', 'application/json');
            const res = await fetch(
                `http://localhost:3000/projects/${uuid}`,
                {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: `newName${i}`,
                    description: `decription${i}`,
                    autoConvert: false
                }),
            }
            );
        
            expect(res.status).toBe(200);
            
            const projectRes = await res.json();
            expect(projectRes['name']).toBe(`newName${i}`);
        }
    });

    test('if user with admin role can delete any project', async () => {
          // TODO check if preserving the database makes sense
          const {user:user} = await generateAndFetchDbUser('internal', 'user');

          const projectRepository = db.getRepository('Project');
  
          const projectUuids = await Promise.all(
              Array.from({ length: 5 }, async (_, i) => {
                  const project = await projectRepository.save(
                      projectRepository.create({
                          creator: user.uuid,
                          name: `test_project${i + 1}`,
                          description: `This is a test project ${i + 1}`,
                          autoConvert: false
                      })
                  );
                  return project['uuid'];
              })
          );
          
          const projects1 = await projectRepository.find();
          expect(projects1.length).toBe(5);
  
          const {token:admin_token, res:res } = await generateAndFetchDbUser('internal', 'admin');
          
          for (const [i, uuid] of projectUuids.entries()) {
              // Check read access
              const headerCreator = new HeaderCreator(undefined, admin_token);
              headerCreator.addHeader('Content-Type', 'application/json');
              const res = await fetch(
                  `http://localhost:3000/projects/${uuid}`,
                  {
                    method: 'DELETE',
                    headers: headerCreator.getHeaders(),}
              );
          
              expect(res.status).toBe(200);
          }
          
          const projects = await projectRepository.find();
          expect(projects.length).toBe(0);
    });

        // external
    test('third party user cannot view any project by default', async () => {
        // TODO check if preserving the database makes sense
        const {user:user, token:token}= await generateAndFetchDbUser('internal', 'user');

        const {token:externaltoken}   = await generateAndFetchDbUser('external', 'user');
        const projectRepository       = db.getRepository('Project');
        const membershipRepository    = db.getRepository('group_membership')
        const accessGroupRepository   = db.getRepository('access_group')
        const projectAccessRepository = db.getRepository('project_access')

        const numberOfProjects = 10
        console.log(`[DEBUG]: Generate ${numberOfProjects} test projects.`);

        const projectUuids = await Promise.all(
            [...Array(numberOfProjects)].map(async (_, i) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: user.uuid,
                        name: `test_project${i + 1}`,
                        description: `This is a test project ${i + 1}`,
                        autoConvert: false,
                    })
                );
                return project['uuid']
            })
        );


        // get accessGroupUuid for userUuid in group membership'

        console.log(`[DEBUG]: Generate project access for internal user.`);
        const accessGroups = await membershipRepository.find({
            where: { user: { uuid: user.uuid }},
            relations: ['accessGroup']
        });

        for (const group in accessGroups) {
            if (!group['accessGroup']) {
                console.error('Error: accessGroup is undefined for group:', group);
                return;
            }
        
            const accessGroupUuid = group['accessGroup']['uuid'];
        
            (async () => {
                for (const uuid of projectUuids) {
                    await projectAccessRepository.save(
                        projectAccessRepository.create({
                            accessGroup: accessGroupUuid,
                            project: uuid,
                            rights: 10,
                        })
                    );
                }
            })();
        }
        
        // check if projects are generated
        const projects = await projectRepository.findAndCount();
        expect(projects[1]).toBe(numberOfProjects);

        // try to get all projects with internal user
          const headerCreator = new HeaderCreator(undefined, token);
          headerCreator.addHeader('Content-Type', 'application/json')

          const res = await fetch(
            `http://localhost:3000/oldProject/filtered?take=20&skip=0&sortBy=name&sortDirection=ASC`,
            {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            },
        );
        
        expect(res.status).toBe(200)
        const projectList = await res.json()
        console.log('projectList', projectList)
        expect(projectList.data.length).toBe(numberOfProjects);

        // check single project view access
        const headerCreator1 = new HeaderCreator(undefined, externaltoken);
        headerCreator1.addHeader('Content-Type', 'application/json')
        const res1 = await fetch(
            `http://localhost:3000/projects/${projectUuids[0]}`,
            {
                method: 'GET',
                headers: headerCreator1.getHeaders(),
            },
        );
        
        expect(res1.status).toBe(403);

        // check list of projects view access
        const res2 = await fetch(
            `http://localhost:3000/oldProject/filtered?take=20&skip=0&sortBy=name&sortDirection=ASC`,
            {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            },
        );

        expect(res2.status).toBe(200)
        const projectList1 = await res2.json()
        expect(Array.isArray(projectList1.data)).toBe(true);
        expect(projectList1.data.length).toBe(0);
 
    });

    // test('if external user cannot create a new project', async () => {
    //     const mockEmail = 'some-external@ethz.ch';
    //     const externalUuid = await mockDbUser(mockEmail);

    //     const userRepository = db.getRepository(User);
    //     const user = await userRepository.findOneOrFail({
    //         where: { uuid: externalUuid },
    //     });

    //     const projectRepository = db.getRepository('Project');
    //     const project = projectRepository.create();
    //     project['name'] = 'test_project';
    //     project['description'] = 'This is a test project';

    //     const token = await getJwtToken(user);
    //     const res = await fetch(`http://localhost:3000/projects`, {
    //         method: 'POST',
    //         headers: {
    //             cookie: `authtoken=${token}`,

    //             'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify({
    //             name: project['name'],
    //             description: project['description'],
    //             requiredTags: [],
    //         }),
    //     });

    //     expect(res.status).toBe(403);
    //     const projects = await projectRepository.find();
    //     expect(projects.length).toBe(0);
    // });

    // test('if external user cannot delete any project', async () => {
    //     const mockEmail = 'some-external@ethz.ch';
    //     const externalUuid = await mockDbUser(mockEmail);

    //     const userRepository = db.getRepository(User);
    //     const user = await userRepository.findOneOrFail({
    //         where: { uuid: externalUuid },
    //     });

    //     const projectRepository = db.getRepository('Project');
    //     const project = projectRepository.create();
    //     project['name'] = 'test_project';
    //     project['description'] = 'This is a test project';
    //     const projectRes = await projectRepository.save(project);

    //     const token = await getJwtToken(user);
    //     const res = await fetch(
    //         `http://localhost:3000/projects/${projectRes['uuid']}`,
    //         {
    //             method: 'DELETE',
    //             headers: {
    //                 cookie: `authtoken=${token}`,
    //             },
    //         },
    //     );

    //     expect(res.status).toBe(403);
    //     const projects = await projectRepository.find();
    //     expect(projects.length).toBe(1);
    // });


    // // projects tab endpoints

    // test('if project can only be edited by users with edit access', async () => {
    //     // TODO: implement this test

    //     expect(true).toBe(true);
    // });

    // test('if project tags can only be configured by users with edit or higher access', async () => {
    //     // TODO: implement this test

    //     expect(true).toBe(true);
    // });

    // test('if project access can only be managed by users with edit or higher access', async () => {
    //     // TODO: implement this test

    //     expect(true).toBe(true);
    // });
    
    // test('if project can only be deleted by users with delete access', async () => {
    //     const mockEmail = 'some-external@ethz.ch';
    //     const externalUuid = await mockDbUser(mockEmail);

    //     const userRepository = db.getRepository(User);
    //     const externalUser = await userRepository.findOneOrFail({
    //         where: { uuid: externalUuid },
    //         relations: ['memberships', 'memberships.accessGroup'],
    //     });

    //     const projectRepository = db.getRepository('Project');
    //     const project = projectRepository.create();

    //     project['name'] = 'test_project';
    //     project['description'] = 'This is a test project';
    //     const projectRes = await projectRepository.save(project);

    //     // delete the project using the external user
    //     const tokenExternal = getJwtToken(externalUser);
    //     const deleteRequest = {
    //         method: 'DELETE',
    //         headers: {
    //             cookie: `authtoken=${tokenExternal}`,
    //         },
    //     };

    //     const res = await fetch(
    //         `http://localhost:3000/projects/${projectRes['uuid']}`,
    //         deleteRequest,
    //     );
    //     expect(res.status).toBe(403);

    //     if (project['project_accesses'] === undefined) {
    //         throw new Error('Project access not set');
    //     }

    //     project['project_accesses'] = [
    //         {
    //             rights: AccessGroupRights.DELETE,
    //             accessGroup: externalUser?.memberships?.find(
    //                 (group) =>
    //                     group?.accessGroup?.type === AccessGroupType.PRIMARY,
    //             )?.accessGroup?.uuid,
    //         },
    //     ];
    //     await projectRepository.save(project);

    //     const res2 = await fetch(
    //         `http://localhost:3000/projects/${projectRes['uuid']}`,
    //         deleteRequest,
    //     );
    //     expect(res2.status).toBe(200);
    // });
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