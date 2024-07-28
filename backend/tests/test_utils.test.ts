import {appDataSource, clearAllData, get_jwt_token, mock_db_user} from "./utils/database_utils";
import User from "@common/entities/user/user.entity";
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

test('test if clearAllData works', async () => {

    // Insert some data
    const user = new User();
    user.name = 'John Doe';
    user.email = 'test-01@leggedrobotics.com';
    user.role = UserRole.USER;

    await appDataSource.getRepository(User).save(user);

    // Check if the data was inserted
    const users = await appDataSource.getRepository(User).find();
    expect(users.length).toBe(1);

    // Clear the data
    await clearAllData();

    // Check if the data was cleared
    const usersAfterClear = await appDataSource.getRepository(User).find();
    expect(usersAfterClear.length).toBe(0);

});


test('Create User with Valid Token', async () => {

    await mock_db_user('John Doe', 'test-01@leggedrobotics.com');

    const userRepository = appDataSource.getRepository(User);
    const users = await userRepository.find();
    expect(users.length).toBe(1);
    expect(users[0].email).toBe('test-01@leggedrobotics.com');

    const accountRepository = appDataSource.getRepository('Account');
    const accounts = await accountRepository.find();
    expect(accounts.length).toBe(1);

    const accessGroupRepository = appDataSource.getRepository('AccessGroup');
    const accessGroups = await accessGroupRepository.find();
    expect(accessGroups.length).toBe(2);

    // call /user/me without unauthenticated --> expect 401
    const res = await fetch(`http://localhost:3000/user/me`, {
        method: 'GET',
    });
    expect(res.status).toBe(401);

    // call endpoint /user/me with authenticated user --> expect 200
    const res2 = await fetch(`http://localhost:3000/user/me`, {
        method: 'GET',
        headers: {
            'cookie': `authtoken=${await get_jwt_token(users[0])}`
        },
        credentials: "include"
    });

    expect(res2.status).toBe(200);

})