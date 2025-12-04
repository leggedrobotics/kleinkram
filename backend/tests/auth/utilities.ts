import { AccessGroupType, UserRole } from '@kleinkram/backend-common';
import AccessGroupEntity from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import UserEntity from '@kleinkram/backend-common/entities/user/user.entity';
import { HeaderCreator } from '../utils/api-calls';
import {
    database,
    getJwtToken,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

// DEFAUL_URL for backend
export const DEFAULT_URL =
    process.env['DEFAULT_URL'] ?? 'http://localhost:3000';
export const DEFAULT_GROUP_UUIDS: [string] = [
    '00000000-0000-0000-0000-000000000000',
] as const;
export const getAllAccessGroups = async (): Promise<AccessGroupEntity[]> => {
    const accessGroupRepository =
        database.getRepository<AccessGroupEntity>(AccessGroupEntity);
    return await accessGroupRepository.find({
        relations: ['members', 'members.user'],
        select: {
            memberships: {
                uuid: true,
                user: {
                    uuid: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
        },
    });
};

/**
 * Verify if an access group with the passed uuid exists
 *
 * @param uuid uuid of the access group to search for
 * @param accessGroups list of access groups to search in
 */
export const verifyIfGroupWithUUIDExists = (
    uuid: string,
    accessGroups: AccessGroupEntity[],
) => {
    const group = accessGroups.filter(
        (_group: AccessGroupEntity) => _group.uuid === uuid,
    );
    expect(group.length).toBe(1);
};
/**
 * Get the personal access group of the user with the passed email
 *
 * @param email email of the user
 * @param accessGroups list of access groups
 *
 * @returns access group of the user
 */
export const getAccessGroupForEmail = (
    email: string,
    accessGroups: AccessGroupEntity[],
): AccessGroupEntity => {
    const group: AccessGroupEntity[] =
        accessGroups.filter((_group: AccessGroupEntity) =>
            _group.memberships?.some(
                (accessGroupUser) =>
                    accessGroupUser.user?.email === email &&
                    _group.type === AccessGroupType.PRIMARY,
            ),
        ) ?? [];

    const thereIsOnlyOnePersonalGroup = group.length === 1;
    expect(thereIsOnlyOnePersonalGroup).toBe(true);

    return group[0] as unknown as AccessGroupEntity;
};

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
        while (true) {
            try {
                await userRepository.findOneOrFail({
                    where: { email: userEmail },
                });
                // If the user exists, modify the email and username
                const [name, domain] = baseEmail.split('@');
                userEmail = `${name}${counter}@${domain}`;
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
                `Failed to fetch data: ${response.status} ${response.statusText}`,
            );
        }

        return { user, token, response };
    } catch (error) {
        console.error('Error in generateAndFetchDbUser:', error);
        throw error;
    }
};
