import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import { getAuthHeaders } from '../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';
import { DEFAULT_URL } from './utilities';

const changeRole = async (
    admin: UserEntity,
    action: 'promote' | 'demote',
    body: unknown,
): Promise<{ status: number; message: unknown }> => {
    const response = await fetch(`${DEFAULT_URL}/users/${action}`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(admin),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const json = (await response.json()) as { message?: unknown };
    return { status: response.status, message: json.message };
};

const createUser = async (email: string, role: UserRole): Promise<UserEntity> =>
    getUserFromDatabase(await mockDatabaseUser(email, email, role));

const roleOf = async (email: string): Promise<UserRole | undefined> => {
    const user = await database
        .getRepository(UserEntity)
        .findOne({ where: { email }, select: { role: true } });
    return user?.role;
};

describe('User Role Change', () => {
    setupDatabaseHooks();

    test.each([
        ['without an email', {}],
        ['with a null email', { email: null }],
        ['with a malformed email', { email: 'not-an-email' }],
    ])('should return 400 for a request %s', async (_label, body) => {
        const admin = await createUser(
            'admin@leggedrobotics.com',
            UserRole.ADMIN,
        );

        const promote = await changeRole(admin, 'promote', body);
        const demote = await changeRole(admin, 'demote', body);

        expect(promote.status).toBe(400);
        expect(demote.status).toBe(400);
    });

    test('should return 404 if no user has the email', async () => {
        const admin = await createUser(
            'admin@leggedrobotics.com',
            UserRole.ADMIN,
        );

        const response = await changeRole(admin, 'promote', {
            email: 'nobody@leggedrobotics.com',
        });

        expect(response.status).toBe(404);
    });

    test('should promote and demote a user', async () => {
        const admin = await createUser(
            'admin@leggedrobotics.com',
            UserRole.ADMIN,
        );
        await createUser('member@leggedrobotics.com', UserRole.USER);

        const promote = await changeRole(admin, 'promote', {
            email: 'member@leggedrobotics.com',
        });
        expect(promote.status).toBeLessThan(300);
        expect(await roleOf('member@leggedrobotics.com')).toBe(UserRole.ADMIN);

        const demote = await changeRole(admin, 'demote', {
            email: 'member@leggedrobotics.com',
        });
        expect(demote.status).toBeLessThan(300);
        expect(await roleOf('member@leggedrobotics.com')).toBe(UserRole.USER);
    });

    test('should refuse to demote the last admin', async () => {
        const admin = await createUser(
            'admin@leggedrobotics.com',
            UserRole.ADMIN,
        );

        const response = await changeRole(admin, 'demote', {
            email: 'admin@leggedrobotics.com',
        });

        expect(response.status).toBe(409);
        expect(response.message).toBe("Can't demote the last admin");
        expect(await roleOf('admin@leggedrobotics.com')).toBe(UserRole.ADMIN);
    });
});
