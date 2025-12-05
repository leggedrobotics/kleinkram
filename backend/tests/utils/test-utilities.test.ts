import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import { clearAllData, database, mockDatabaseUser } from './database-utilities';

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
        const user = new UserEntity();
        user.name = 'John Doe';
        user.email = 'test-01@kleinkram.dev';
        user.role = UserRole.USER;

        await database.getRepository(UserEntity).save(user);

        // Check if the data was inserted
        const users = await database.getRepository(UserEntity).find();
        expect(users.length).toBe(1);

        // Clear the data
        await clearAllData();

        // Check if the data was cleared
        const usersAfterClear = await database.getRepository(UserEntity).find();
        expect(usersAfterClear.length).toBe(0);
    });

    test('Create User with Valid Token', async () => {
        // TODO: Finish this test

        await mockDatabaseUser('test-01@kleinkram.dev');

        const userRepository = database.getRepository(UserEntity);
        const users = await userRepository.find({
            select: ['email', 'uuid'],
        });
        expect(users.length).toBe(1);
        expect(users[0]?.email).toBe('test-01@kleinkram.dev');

        const accountRepository = database.getRepository(AccountEntity);
        const accounts = await accountRepository.find();
        expect(accounts.length).toBe(1);

        const accessGroupRepository = database.getRepository(AccessGroupEntity);
        const accessGroups = await accessGroupRepository.find();
        expect(accessGroups.length).toBe(2);
    });
});
