import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { db } from '../utils/database_utils';

export const DEFAULT_GROUP_UUIDS = ['00000000-0000-0000-0000-000000000000'];
export const getAllAccessGroups = async (): Promise<AccessGroup[]> => {
    const accessGroupRepository = db.getRepository('AccessGroup');
    return (await accessGroupRepository.find({
        relations: ['users'],
    })) as AccessGroup[];
};
/**
 * Verify if an access group with the passed uuid exists
 *
 * @param uuid uuid of the access group to search for
 * @param access_groups list of access groups to search in
 */
export const verifyIfGroupWithUUIDExists = (
    uuid: string,
    access_groups: AccessGroup[],
) => {
    const group = access_groups.filter(
        (group: AccessGroup) => group.uuid === uuid,
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
    const group = accessGroups.filter((group: AccessGroup) =>
        group.users.some((user) => user.email === email && group.personal),
    );

    const thereIsOnlyOnePersonalGroup = group.length === 1;
    expect(thereIsOnlyOnePersonalGroup).toBe(true);

    return group[0];
};