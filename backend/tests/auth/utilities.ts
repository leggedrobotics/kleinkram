import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import { HeaderCreator } from '../utils/api-calls';
import {
    database,
    getJwtToken,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

// DEFAUL_URL for backend
export const DEFAULT_URL = process.env.DEFAULT_URL ?? 'http://localhost:3000';

/**
 * Generates a user in the database, retrieves user details, and fetches a response.
 *
 * @param userType - Specifies if the user is internal or external.
 * @param userRole - Specifies the role of the user (admin or standard user).
 *
 * @returns An object containing user details, authentication token, and fetch response.
 * @throws Will throw an error if an invalid userType is provided or fetch fails.
 */
export const generateAndFetchDatabaseUser = async (
    userType: 'internal' | 'external',
    userRole: 'user' | 'admin',
): Promise<{ user: UserEntity; token: string; response: Response }> => {
    try {
        const roleEnum = userRole === 'admin' ? UserRole.ADMIN : UserRole.USER;

        const baseEmail =
            userType === 'internal'
                ? 'internal-user@kleinkram.dev'
                : 'external-user@third-party.com';

        let userEmail = baseEmail;
        let counter = 1;
        let username = baseEmail.split('@')[0]; // Extract name before '@'

        // get userRepo
        const userRepository = database.getRepository(UserEntity);

        // Check if user already exists and find an available email and username
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
            try {
                await userRepository.findOneOrFail({
                    where: { email: userEmail },
                });
                // If the user exists, modify the email and username
                const [name, domain] = baseEmail.split('@');
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                userEmail = `${name}${counter}@${domain}`;
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                username = `${name}${counter}`;
                counter++;
            } catch {
                break;
            }
        }

        const userId = await mockDatabaseUser(userEmail, username, roleEnum);
        const user = await getUserFromDatabase(userId);

        const token = getJwtToken(user);

        // Header
        const headerCreator = new HeaderCreator(user);

        const response = await fetch(
            `${DEFAULT_URL}/projects?take=20&skip=0&sortBy=name&sortOrder=ASC`,
            {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            },
        );

        if (!response.ok) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Failed to fetch data: ${response.status} ${response.statusText}`,
            );
        }

        return { user, token, response };
    } catch (error) {
        console.error('Error in generateAndFetchDbUser:', error);
        throw error;
    }
};
