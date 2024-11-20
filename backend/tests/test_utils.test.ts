import {
    db,
    clearAllData,
    getJwtToken,
    mockDbUser,
} from './utils/database_utils';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';

describe('Test Suite Utils', () => {
    beforeAll(async () => {
        await db.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(() => {
        console.log("Destroying appDataSource 'Test Suite Utils'");
        db.destroy();
    });

    test('test if clearAllData works', async () => {
        // Insert some data
        const user = new User();
        user.name = 'John Doe';
        user.email = 'test-01@leggedrobotics.com';
        user.role = UserRole.USER;

        await db.getRepository(User).save(user);

        // Check if the data was inserted
        const users = await db.getRepository(User).find();
        expect(users.length).toBe(1);

        // Clear the data
        await clearAllData();

        // Check if the data was cleared
        const usersAfterClear = await db.getRepository(User).find();
        expect(usersAfterClear.length).toBe(0);
    });

    test('Create User with Valid Token', async () => {
        await mockDbUser('test-01@leggedrobotics.com');

        const userRepository = db.getRepository(User);
        const users = await userRepository.find({
            select: ['email', 'uuid'],
        });
        expect(users.length).toBe(1);
        expect(users[0].email).toBe('test-01@leggedrobotics.com');

        const accountRepository = db.getRepository('Account');
        const accounts = await accountRepository.find();
        expect(accounts.length).toBe(1);

        const accessGroupRepository = db.getRepository('AccessGroup');
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
                cookie: `authtoken=${await getJwtToken(users[0])}`,
            },
            credentials: 'include',
        });

        expect(res2.status).toBe(200);
    });
});
