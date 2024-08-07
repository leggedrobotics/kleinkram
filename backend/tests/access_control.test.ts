import User from '@common/entities/user/user.entity';
import {
    clearAllData,
    db,
    get_jwt_token,
    get_user_from_db,
    mock_db_user,
} from './utils/database_utils';
import { UserRole } from '@common/enum';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { create_project_using_post } from './utils/api_calls';
import process from 'node:process';

describe('Access Control', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    test('non leggedrobotics.com email is not added to default group', async () => {
        const default_groups = ['00000000-0000-0000-0000-000000000000'];

        const external_uuid = await mock_db_user(
            'external-user@third-party.com',
        );

        // check if the user is not added to the default group
        const accessGroupRepository = db.getRepository('AccessGroup');
        const accessGroups = await accessGroupRepository.find();
        expect(accessGroups.length).toBe(2);

        // one access group should be personal
        const personal_group = accessGroups.filter(
            (group: AccessGroup) => group.personal === true,
        );
        expect(personal_group.length).toBe(1);

        // one access group should have the default uuid
        const default_group = accessGroups.filter(
            (group: AccessGroup) => group.uuid === default_groups[0],
        );
        expect(default_group.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: external_uuid },
            relations: ['accessGroups'],
        });
        expect(user.email).toBe('external-user@third-party.com');

        // check if the user with a non default email is not added to the default group
        user.accessGroups.forEach((accessGroup: AccessGroup) => {
            expect(default_groups.includes(accessGroup.uuid)).toBe(false);
        });

        // user is only part of the personal group
        expect(user.accessGroups.length).toBe(1);
        user.accessGroups.forEach((accessGroup: AccessGroup) => {
            expect(accessGroup.personal).toBe(true);
        });
    });

    test('if leggedrobotics email is added to default group', async () => {
        const default_groups = ['00000000-0000-0000-0000-000000000000'];
        const uuid = await mock_db_user('internal-user@leggedrobotics.com');

        // check if the user is added to the default group
        const accessGroupRepository = db.getRepository('AccessGroup');
        const accessGroups = await accessGroupRepository.find();
        expect(accessGroups.length).toBe(2);

        // one access group should be personal
        const personal_group = accessGroups.filter(
            (group: AccessGroup) => group.personal === true,
        );
        expect(personal_group.length).toBe(1);

        // one access group should have the default uuid
        const default_group = accessGroups.filter(
            (group: AccessGroup) => group.uuid === default_groups[0],
        );
        expect(default_group.length).toBe(1);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: uuid },
            relations: ['accessGroups'],
        });

        expect(user.email).toBe('internal-user@leggedrobotics.com');
    });

    test('reject allow self-signed JWT token', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ user: '' }, 'this-is-not-the-server-secret');

        const res = await fetch(`http://localhost:3000/project/create`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,
            },
            body: JSON.stringify({
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });

        expect(res.status).toBe(401);
    });

    test('reject corrupted (empty) JWT token', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ user: { uuid: '' } }, process.env.JWT_SECRET);

        const res = await fetch(`http://localhost:3000/project/create`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,
            },
            body: JSON.stringify({
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });

        expect(res.status).toBe(403);
    });

    test('if user with leggedrobotics email is allowed to create new project', async () => {
        const user_id = await mock_db_user('internal-user@leggedrobotics.com');
        const user = await get_user_from_db(user_id);

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('Test Project');
        expect(project.description).toBe('This is a test project');
    });

    test('if user with admin role is allowed to create new project', async () => {
        const user_id = await mock_db_user(
            'John Doe',
            'test@example.com',
            UserRole.ADMIN,
        );
        const user = await get_user_from_db(user_id);

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('Test Project');
        expect(project.description).toBe('This is a test project');
    });

    test('if user with admin role can view all projects', async () => {
        // generate 10 projects
        const projectRepository = db.getRepository('Project');
        const project_uuids = [];
        for (let i = 0; i < 10; i++) {
            const project = projectRepository.create();
            project.name = `Project ${i}`;
            project.description = `This is project ${i}`;
            const project_res = await projectRepository.save(project);
            project_uuids.push(project_res.uuid);
        }

        // check if the projects are created
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);

        const user_id = await mock_db_user(
            'some-admin@third-party.com',
            undefined,
            UserRole.ADMIN,
        );
        const user = await get_user_from_db(user_id);

        const token = await get_jwt_token(user);
        const res = await fetch(
            `http://localhost:3000/project?take=11&skip=0&sortBy=name&descending=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );
        expect(res.status).toBe(200);
        const project_list = await res.json();
        console.log(project_list);
        expect(project_list[0].length).toBe(10);
        project_list[0]?.forEach((project) => {
            expect(project_uuids.includes(project.uuid)).toBe(true);
        });
    });

    test('the creator of a project has delete access to the project', async () => {
        const user_ud = await mock_db_user('creator@leggedrobotics.com');
        const user = await get_user_from_db(user_ud);

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        // check if project is created by reading the database
        const projectRepository = db.getRepository('Project');
        let project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('Test Project');

        // delete the project using the API
        const token = await get_jwt_token(user);
        const res = await fetch(
            `http://localhost:3000/project/delete?uuid=${project_uuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );

        expect(res.status).toBe(200);

        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if user with admin role can delete any project', async () => {
        const creator_user_id = await mock_db_user(
            'creator@leggedrobotics.com',
        );
        const userRepository = db.getRepository(User);
        const user = await userRepository.findOne({
            where: { uuid: creator_user_id },
        });

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        let projects = await projectRepository.find();
        expect(projects.length).toBe(1);

        const admin_user_id = await mock_db_user(
            'third-party-admin@test.com',
            undefined,
            UserRole.ADMIN,
        );
        const third_party_user = await userRepository.findOne({
            where: { uuid: admin_user_id },
        });
        const third_party_token = await get_jwt_token(third_party_user);

        const res = await fetch(
            `http://localhost:3000/project/delete?uuid=${project_uuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${third_party_token}`,
                },
            },
        );
        expect(res.status).toBe(200);

        projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('third party user cannot view any project by default', async () => {
        const interal_user_id = await mock_db_user(
            'some-interal-user@leggedrobotics.com',
        );
        const internal_user = await get_user_from_db(interal_user_id);

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            internal_user,
        );

        const projectRepository = db.getRepository('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);

        const external_user_id = await mock_db_user(
            'some-external-user@third-party.com',
        );
        const external_user = await get_user_from_db(external_user_id);
        const external_user_token = await get_jwt_token(external_user);

        // check single project view access
        const res2 = await fetch(
            `http://localhost:3000/project/one?uuid=${project_uuid}`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${external_user_token}`,
                },
            },
        );
        expect(res2.status).toBe(403);

        // check list of projects view access
        const res = await fetch(
            `http://localhost:3000/project?take=10&skip=0&sortBy=name&descending=false`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${external_user_token}`,
                },
            },
        );
        expect(res.status).toBe(200);
        const project_list = await res.json();
        expect(project_list[0].length).toBe(0);
    });

    test('internal user have read only access by default', async () => {
        const interal_user_id = await mock_db_user(
            'internal-1@leggedrobotics.com',
        );
        const user = await get_user_from_db(interal_user_id);

        const project_uuid = await create_project_using_post(
            {
                name: 'Test Project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('Test Project');

        const second_user_id = await mock_db_user(
            'internal-2@leggedrobotics.com',
        );
        const second_user = await get_user_from_db(second_user_id);

        // check view access
        const token = await get_jwt_token(second_user);
        const res = await fetch(
            `http://localhost:3000/project/one?uuid=${project_uuid}`,
            {
                method: 'GET',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );
        expect(res.status).toBe(200);
        const project_res = await res.json();
        expect(project_res.name).toBe('Test Project');

        // check denied modification access
        const res2 = await fetch(
            `http://localhost:3000/project/update?uuid=${project_uuid}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: `authtoken=${token}`,
                },
                body: JSON.stringify({
                    name: '1234',
                    description: '1234',
                    requiredTags: [],
                }),
            },
        );
        expect(res2.status).toBe(403);

        // check denied delete access
        const res3 = await fetch(
            `http://localhost:3000/project/delete?uuid=${project_uuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );
        expect(res3.status).toBe(403);

        // assert that the project is not deleted
        const projects = await projectRepository.find();
        expect(projects.length).toBe(1);
        expect(projects[0].uuid).toBe(project_uuid);
        expect(projects[0].name).toBe('Test Project');
    });
});
