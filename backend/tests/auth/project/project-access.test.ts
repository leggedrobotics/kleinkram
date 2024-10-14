import User from '@common/entities/user/user.entity';
import {
    clearAllData,
    db,
    get_jwt_token,
    get_user_from_db,
    mock_db_user,
} from '../../utils/database_utils';
import { AccessGroupRights, UserRole } from '@common/enum';
import { create_project_using_post } from '../../utils/api_calls';

/**
 * This test suite tests the access control of the application.
 *
 */
describe('Verify Project Level Access', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await db.destroy();
    });

    test('if user with leggedrobotics email is allowed to create new project', async () => {
        const user_id = await mock_db_user('internal-user@leggedrobotics.com');
        const user = await get_user_from_db(user_id);

        const project_uuid = await create_project_using_post(
            {
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('test_project');
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
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('test_project');
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
            `http://localhost:3000/project/filtered?take=11&skip=0&sortBy=name&descending=false`,
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
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        // check if project is created by reading the database
        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('test_project');

        // delete the project using the API
        const token = await get_jwt_token(user);
        const url = `http://localhost:3000/project/${project_uuid}`;
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
                name: 'test_project',
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
            `http://localhost:3000/project/${project_uuid}`,
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
                name: 'test_project',
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
            `http://localhost:3000/project/filtered?take=10&skip=0&sortBy=name&descending=false`,
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
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            },
            user,
        );

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('test_project');

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
        expect(project_res.name).toBe('test_project');

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
        expect(projects[0].name).toBe('test_project');
    });

    test('if external user cannot create a new project', async () => {
        const mock_email = 'some-external@ethz.ch';
        const external_uuid = await mock_db_user(mock_email);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: external_uuid },
        });

        const projectRepository = db.getRepository('Project');
        const project = projectRepository.create();
        project.name = 'test_project';
        project.description = 'This is a test project';

        const token = await get_jwt_token(user);
        const res = await fetch(`http://localhost:3000/project/create`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: project.name,
                description: project.description,
                requiredTags: [],
            }),
        });

        expect(res.status).toBe(403);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if external user cannot delete a project', async () => {
        const mock_email = 'some-external@ethz.ch';
        const external_uuid = await mock_db_user(mock_email);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: external_uuid },
        });

        const projectRepository = db.getRepository('Project');
        const project = projectRepository.create();
        project.name = 'test_project';
        project.description = 'This is a test project';
        const project_res = await projectRepository.save(project);

        const token = await get_jwt_token(user);
        const res = await fetch(
            `http://localhost:3000/project/${project_res.uuid}`,
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

    test('if project can only be deleted by users with delete access', async () => {
        const mock_email = 'some-external@ethz.ch';
        const external_uuid = await mock_db_user(mock_email);

        const userRepository = db.getRepository(User);
        const user = await userRepository.findOneOrFail({
            where: { uuid: external_uuid },
        });

        const project_uuid = await create_project_using_post(
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

        const token = await get_jwt_token(user);
        const res = await fetch(
            `http://localhost:3000/project/${project_uuid}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: `authtoken=${token}`,
                },
            },
        );

        expect(res.status).toBe(200);
        const projectRepository = db.getRepository('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if project can only be deleted if it has no missions', async () => {
        const mock_email = 'internal@leggedrobotics.com';
        const user_id = await mock_db_user(mock_email);
        const user = await get_user_from_db(user_id);

        const project_uuid = await create_project_using_post(
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

        const projectRepository = db.getRepository('Project');
        const project = await projectRepository.findOneOrFail({
            where: { uuid: project_uuid },
        });
        expect(project.name).toBe('test_project');
    });

    test('if viewer of a project cannot add any tag types', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if editor of a project can add any tag types', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if viewer of a project cannot delete any tag types', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });

    test('if editor of a project can delete any tag types', async () => {
        // TODO: implement this test
        expect(true).toBe(false);
    });
});
