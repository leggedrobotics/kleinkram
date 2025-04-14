import User from '@common/entities/user/user.entity';
import {
    clearAllData,
    database
} from '../utils/database-utilities';

import { SubmitActionDto } from '@common/api/types/submit-action-response.dto';
import ActionTemplate from '@common/entities/action/action-template.entity';
import Action from '@common/entities/action/action.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import { AccessGroupRights } from '@common/frontend_shared/enum';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import { createActionUsingPost, createMissionUsingPost, createProjectUsingPost, HeaderCreator } from '../utils/api-calls';


describe('Verify Action', () => {

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
        // get access group for creator and user
        const accessGroupRepository = database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });
        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
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
                    {
                        rights: AccessGroupRights.CREATE,
                        accessGroupUUID: accessGroupUser.uuid,
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
        
        // create a mission
        globalThis.missionUuid = await createMissionUsingPost(
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
                where: { uuid: globalThis.missionUuid },
        });
        expect(mission['name']).toBe('test_mission');
        const missions = await missionRepository.find();
        expect(missions.length).toBe(1);
        console.log(`[DEBUG]: Mission created with UUID: ${globalThis.missionUuid}`);
    
        // create action
        globalThis.actionUuid = await createActionUsingPost(
            {
                name: 'test_action',
                command: '',
                cpuCores: 2,
                cpuMemory: 2,
                entrypoint: 'd',
                gpuMemory: -1,
                dockerImage: 'rslethz/test',
                accessRights: AccessGroupRights.DELETE,
                maxRuntime: 1,
                searchable: false
            },
            globalThis.creator,
        );
        // check if action is generated
        const actionRepository = database.getRepository<ActionTemplate>('ActionTemplate');
        const action = await actionRepository.findOneOrFail({
            where: { uuid: globalThis.actionUuid },
        });
        expect(action['name']).toBe('test_action');
        const actions = await actionRepository.find();
        expect(actions.length).toBe(1);
        console.log(`[DEBUG]: Action created with UUID: ${globalThis.actionUuid}`);    
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

        // delete all action templates
        const actionTemplateRepository = database.getRepository<ActionTemplate>('action_template');
        const allActionTemplates = await actionTemplateRepository.find();

        console.log('DEBUG: all templates',allActionTemplates);

        await actionTemplateRepository.remove(allActionTemplates);
        const remainingActionTemplates = await actionTemplateRepository.find();
        
        expect(remainingActionTemplates.length).toBe(0);
        console.log(`[DEBUG]: All Action Template removed.`);

        // delete all actions
        const actionsRepository = database.getRepository<Action>('Action');
        const allActions = await actionsRepository.find();
        await actionsRepository.remove(allActions);
        const remainingActions = await actionsRepository.find();
        
        expect(remainingActions.length).toBe(0);
        console.log(`[DEBUG]: All Actions removed.`);

        // delete all missions
        const missionRepository = database.getRepository('Mission');
        const allMissions = await missionRepository.find();
        await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        console.log(`[DEBUG]: All Missions removed.`);

        // delete project
        const projectRepository = database.getRepository<Project>('Project');
        const allProjects = await projectRepository.find();
        await projectRepository.remove(allProjects);
        const remainingProjects = await projectRepository.find();
        
        expect(remainingProjects.length).toBe(0);
        console.log(`[DEBUG]: All Projects removed.`);
    });

    // afterAll(async () => {
    //     await clearAllData();
    //     await database.destroy();
    // });

    test('if a internal user with create rights can create a action template',async () => {
        // created in beforeEach()
        const actionRepository = database.getRepository<ActionTemplate>('ActionTemplate');
        const action = await actionRepository.findOneOrFail({
            where: { uuid: globalThis.actionUuid },
        });
        expect(action['name']).toBe('test_action');
        const actions = await actionRepository.find();
        expect(actions.length).toBe(1);
    });

    test('if a internal user with create rights can submit a action template',async () => {

        const headersBuilder = new HeaderCreator(globalThis.creator);
        headersBuilder.addHeader('Content-Type', 'application/json');
    
        const response = await fetch(`${DEFAULT_URL}/action/submit`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                missionUUID: globalThis.missionUuid,
                templateUUID: globalThis.actionUuid
            } as SubmitActionDto),
            credentials: 'include',
        });
    
        const json = await response.json();
        console.log(`['DEBUG'] Created action:`, json);
        expect(response.status).toBeLessThan(300);
    });

    // test('if a user with DELETE rights can create a action template', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });


    // // file handling tests
    // test('if file is uploaded and can be downloaded again inside an action', async () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    //     // const filename = 'test_small.bag';

    //     // const userId = await mockDatabaseUser('internal@leggedrobotics.com');
    //     // const user = await getUserFromDatabase(userId);
    //     // // create project
    //     // const projectUuid = await createProjectUsingPost(
    //     //     {
    //     //         name: 'test_project',
    //     //         description: 'test description',
    //     //         requiredTags: [],
    //     //     },
    //     //     user,
    //     // );
    //     // expect(projectUuid).toBeDefined();

    //     // // create mission using the post
    //     // const missionUuid = await createMissionUsingPost(
    //     //     {
    //     //         name: 'test_mission',
    //     //         projectUUID: projectUuid,
    //     //         tags: {},
    //     //         ignoreTags: true,
    //     //     },
    //     //     user,
    //     // );
    //     // expect(missionUuid).toBeDefined();

    //     // const fileHash = await uploadFile(user, filename, missionUuid);

    //     // const createTemplate = await fetch(
    //     //     `http://localhost:3000/action/createTemplate`,
    //     //     {
    //     //         method: 'POST',
    //     //         headers: {
    //     //             cookie: `authtoken=${getJwtToken(user)}`,
    //     //             'Content-Type': 'application/json',
    //     //         },
    //     //         body: JSON.stringify({
    //     //             name: 'test-template',
    //     //             command: '',
    //     //             image: 'rslethz/action:file-hash-latest',
    //     //             cpuCores: 2,
    //     //             cpuMemory: 2,
    //     //             gpuMemory: -1,
    //     //             maxRuntime: 2,
    //     //             searchable: true,
    //     //             accessRights: AccessGroupRights.READ,
    //     //         }),
    //     //     },
    //     // );

    //     // expect(createTemplate.status).toBeLessThan(300);
    //     // const res = await createTemplate.json();
    //     // const uuid = res.uuid;

    //     // // start action container
    //     // const actionSubmission = await fetch(
    //     //     `http://localhost:3000/action/submit`,
    //     //     {
    //     //         method: 'POST',
    //     //         headers: {
    //     //             cookie: `authtoken=${getJwtToken(user)}`,
    //     //             'Content-Type': 'application/json',
    //     //         },
    //     //         body: JSON.stringify({
    //     //             missionUUID: missionUuid,
    //     //             templateUUID: uuid,
    //     //         } as SubmitActionDto),
    //     //     },
    //     // );

    //     // // check if the request was successful
    //     // expect(actionSubmission.status).toBeLessThan(300);

    //     // // get action uuid
    //     // const action = await actionSubmission.json();
    //     // const actionUuid: string = action.uuid;
    //     // expect(actionUuid).toBeDefined();
    //     // let logs: any[] = [];
    //     // await new Promise((resolve) => setTimeout(resolve, 2000));

    //     // while (true) {
    //     //     const _res = await fetch(
    //     //         `http://localhost:3000/action/details?uuid=${actionUuid}`,
    //     //         {
    //     //             method: 'GET',
    //     //             headers: {
    //     //                 cookie: `authtoken=${getJwtToken(user)}`,
    //     //             },
    //     //         },
    //     //     );

    //     //     const json = await _res.json();
    //     //     if (
    //     //         json.state === ActionState.DONE ||
    //     //         json.state === ActionState.FAILED
    //     //     ) {
    //     //         logs = json.logs;
    //     //         console.log('exiting:', json.state);
    //     //         break;
    //     //     }

    //     //     await new Promise((resolve) => setTimeout(resolve, 1000));
    //     // }

    //     // const fileHashString = Buffer.from(fileHash).toString('hex');
    //     // console.log(fileHashString);

    //     // expect(logs).toBeDefined();
    //     // const messages = logs.map((log) => log.message) ?? [];
    //     // console.log(messages);
    //     // const containsFile = messages.some((message) =>
    //     //     message.includes(fileHashString),
    //     // );
    //     // expect(containsFile).toBeTruthy();

    //     // submit a new action
    // }, 30_000);

    // test('if you can upload a file within an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // test('if you can load an existing action and submit it', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // test('if you can load an existing action and save it as a new version', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // test('if you can view details of an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    //     // user: read access
    // test('if a user with read (viewer) access on a mission can view an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });   

    // test('if a user with read access (viewer) on a mission can not create an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // // test('if a user with read access (viewer) cannot cancel an action', () => {
    // //     // TODO: implement this test
    // //     expect(true).toBe(true);
    // // });

    // test('if a user with read access (viewer) cannot delete an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    //     // user: create/edit access
    // test('if a user with edit/create access (creator) on a mission can create an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // // test('if a user with edit/create access (creator) on a mission cannot cancel an action', () => {
    // //     // TODO: implement this test
    // //     expect(true).toBe(true);
    // // });

    // test('if a user with edit/create access (creator) on a mission can delete an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    //     // admin
    // test('if a admin can view details of any action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // test('if a admin can create an action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

    // // test('if a admin can cancel any action', () => {
    // //     // TODO: implement this test
    // //     expect(true).toBe(true);
    // // });

    // test('if a admin can delete any action', () => {
    //     // TODO: implement this test
    //     expect(true).toBe(true);
    // });

});
