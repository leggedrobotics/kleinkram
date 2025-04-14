import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';
import {
    clearAllData,
    database,
    mockDatabaseUser,
} from './utils/database-utilities';

describe('Test Suite Utils', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        console.log("Destroying appDataSource 'Test Suite Utils'");
        await database.destroy();
    });

    test('test if clearAllData works', async () => {
        // Insert some data
        const user = new User();
        user.name = 'John Doe';
        user.email = 'test-01@leggedrobotics.com';
        user.role = UserRole.USER;

        await database.getRepository(User).save(user);

        // Check if the data was inserted
        const users = await database.getRepository(User).find();
        expect(users.length).toBe(1);

        // Clear the data
        await clearAllData();

        // Check if the data was cleared
        const usersAfterClear = await database.getRepository(User).find();
        expect(usersAfterClear.length).toBe(0);
    });

    test('Create User with Valid Token', async () => {
        // TODO: Finish this test

        await mockDatabaseUser('test-01@leggedrobotics.com');

        const userRepository = database.getRepository(User);
        const users = await userRepository.find({
            select: ['email', 'uuid'],
        });
        expect(users.length).toBe(1);
        expect(users[0]?.email).toBe('test-01@leggedrobotics.com');

        const accountRepository = database.getRepository('Account');
        const accounts = await accountRepository.find();
        expect(accounts.length).toBe(1);

        const accessGroupRepository = database.getRepository('AccessGroup');
        const accessGroups = await accessGroupRepository.find();
        expect(accessGroups.length).toBe(2);

        // // call /user/me without unauthenticated --> expect 401
        // const res = await fetch(`http://localhost:3000/user/me`, {
        //     method: 'GET',
        //     // TODO: add kleinkramVersion with HeaderCreator
        // });
        // expect(res.status).toBe(401);

        // if (users[0] === undefined) throw new Error('User not found');

        // // call endpoint /user/me with authenticated user --> expect 200
        // const res2 = await fetch(`http://localhost:3000/user/me`, {
        //     method: 'GET',
        //     headers: {
        //         cookie: `authtoken=${getJwtToken(users[0])}`,
        //     },
        //     credentials: 'include',
        // });

        // expect(res2.status).toBe(200);
    });
});
