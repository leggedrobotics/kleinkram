import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { db,
    getJwtToken,
    getUserFromDb,
    mockDbUser,
 } from '../utils/database_utils';

 import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '../../../../common/frontend_shared/enum';

export const DEFAULT_GROUP_UUIDS = ['00000000-0000-0000-0000-000000000000'];
export const getAllAccessGroups = async (): Promise<AccessGroup[]> => {
    const accessGroupRepository = db.getRepository('AccessGroup');
    return (await accessGroupRepository.find({
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
    })) as AccessGroup[];
};
/**
 * Verify if an access group with the passed uuid exists
 *
 * @param uuid uuid of the access group to search for
 * @param accessGroups list of access groups to search in
 */
export const verifyIfGroupWithUUIDExists = (
    uuid: string,
    accessGroups: AccessGroup[],
) => {
    const group = accessGroups.filter(
        (_group: AccessGroup) => _group.uuid === uuid,
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
    accessGroups: AccessGroup[],
): AccessGroup => {
    const group: AccessGroup[] =
        accessGroups.filter((_group: AccessGroup) =>
            _group.memberships.some(
                (accessGroupUser) =>
                    accessGroupUser.user.email === email && _group.personal,
            ),
        ) || [];

    const thereIsOnlyOnePersonalGroup = group.length === 1;
    expect(thereIsOnlyOnePersonalGroup).toBe(true);

    return group[0];
};

/**
 * Generate user in database and fetch the user
 *
 * @param userType internal or external user
 * @param userRole user or admin
 *
 * @returns user, token and response
 */
export const generateAndFetchDbUser = async (
    userType: 'internal' | 'external',
    userRole: 'user' | 'admin'
): Promise<{ user: any; res: Response, token: string}> => {  

    const roleEnum = userRole === 'admin' ? UserRole.ADMIN : UserRole.USER;

    let userId: string;

    switch (userType) {
        case 'internal':
            userId = await mockDbUser(
                'internal-user@leggedrobotics.com',
                undefined,
                roleEnum
            );
            break;
        
        case 'external':
            userId = await mockDbUser(
                'external-user@third-party.com',
                undefined,
                roleEnum
            );
            break;
        
        default:
            throw new Error('Invalid userType');
    }

    const user = await getUserFromDb(userId);
    const token = await getJwtToken(user);

    const res = await fetch(
        `http://localhost:3000/oldProject/filtered?take=11&skip=0&sortBy=name&descending=false`,
        {
            method: 'GET',
            headers: {
                cookie: `authtoken=${token}`,
            },
        }
    );

    return { user, token, res};
};



