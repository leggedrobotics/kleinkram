import User from "@common/entities/user/user.entity";
import {appDataSource, clearAllData, get_jwt_token, mock_db_user} from "./utils/database_utils";
import {UserRole} from "@common/enum";


beforeAll(async () => {
    await appDataSource.initialize();
    await clearAllData();
});

beforeEach(async () => {
    await clearAllData();
});

afterAll(async () => {
    await appDataSource.destroy();
});


test('Non leggedrobotics Email is not Added to Default Group', async () => {

    const default_groups = ['00000000-0000-0000-0000-000000000000'];

    await mock_db_user('John Doe', 'test-02@example.com');

    const accessGroupRepository = appDataSource.getRepository('AccessGroup');
    const accessGroups = await accessGroupRepository.find();

    expect(accessGroups.length).toBe(2);

    const userRepository = appDataSource.getRepository(User);
    const users = await userRepository.find({relations: ['accessGroups']});
    expect(users.length).toBe(1);

    // check if the user with a non default email is not added to the default group
    const user = users[0];
    expect(user.email).toBe('test-02@example.com')
    user.accessGroups.forEach(accessGroup => {
        expect(default_groups.includes(accessGroup.uuid)).toBe(false);
    });

});

test('if user with leggedrobotics email is allowed to create new project', async () => {

    await mock_db_user('John Doe', 'test-01@leggedrobotics.com');

    const userRepository = appDataSource.getRepository(User);
    const user = (await userRepository.find())[0];

    // call endpoint /project/create with valid token
    const token = await get_jwt_token(user);

    const res = await fetch(`http://localhost:3000/project/create`, {
        method: 'POST',
        headers: {
            'cookie': `authtoken=${token}`
        },
        body: JSON.stringify({
            name: 'Test Project',
            description: 'This is a test project'
        })
    });
    expect(res.status).toBe(200);

    const projectRepository = appDataSource.getRepository('Project');
    const projects = await projectRepository.find();
    expect(projects.length).toBe(1);

});

test('if user with admin role is allowed to create new project', async () => {

    await mock_db_user('John Doe', 'test@example.com', UserRole.ADMIN);

    const userRepository = appDataSource.getRepository(User);
    const user = (await userRepository.find())[0];

    // call endpoint /project/create with valid token
    const token = await get_jwt_token(user);

    const res = await fetch(`http://localhost:3000/project/create`, {
        method: 'POST',
        headers: {
            'cookie': `authtoken=${token}`
        },
        body: JSON.stringify({
            name: 'Test Project 001',
            description: 'This is a test project'
        })
    });
    expect(res.status).toBe(200);

    const projectRepository = appDataSource.getRepository('Project');
    const projects = await projectRepository.find();
    expect(projects.length).toBe(1);

    expect(projects[0].name).toBe('Test Project 001');

})

test('if user with admin role can view all projects', async () => {

    // generate 10 projects
    const projectRepository = appDataSource.getRepository('Project');
    const project_uuids = [];
    for (let i = 0; i < 10; i++) {
        const project = projectRepository.create();
        project.name = `Project ${i}`;
        project.description = `This is project ${i}`;
        const project_res = await projectRepository.save(project)
        project_uuids.push(project_res.uuid);
    }

    await mock_db_user('John Doe', 'test@leggedrobotocs.com', UserRole.ADMIN);
    const userRepository = appDataSource.getRepository(User);
    const user = (await userRepository.find())[0];

    const token = await get_jwt_token(user);

    const res = await fetch(`http://localhost:3000/project`, {
        method: 'GET',
        headers: {
            'cookie': `authtoken=${token}`
        }
    });
    expect(res.status).toBe(200);

    const project_list = await res.json();
    expect(project_list.length).toBe(10);
    project_list.forEach(project => {
        expect(project_uuids.includes(project.uuid)).toBe(true);
    });

})