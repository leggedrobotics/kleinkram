import { UserEntity } from '@kleinkram/backend-common';
import { UserRole } from '@kleinkram/shared';
import { database, mockDatabaseUser } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

/**
 * This test suite tests that user data is correctly persisted and
 * retrievable from the database after creation.
 */
describe('Verify Project Level Access', () => {
    setupDatabaseHooks();

    test('if user is correctly stored and retrievable after creation', async () => {
        const email = 'db-access-test@kleinkram.dev';
        const username = 'DB Access User';
        const userId = await mockDatabaseUser(email, username, UserRole.USER);

        const userRepo = database.getRepository(UserEntity);
        const user = await userRepo.findOneOrFail({
            where: { uuid: userId },
            select: ['uuid', 'email', 'name', 'role'],
        });
        expect(user).toBeDefined();
        expect(user.uuid).toBe(userId);
        expect(user.email).toBe(email);
        expect(user.name).toBe(username);
        expect(user.role).toBe(UserRole.USER);

        // Verify user is in the repository
        const allUsers = await userRepo.find();
        expect(allUsers.length).toBe(1);
    });
});
