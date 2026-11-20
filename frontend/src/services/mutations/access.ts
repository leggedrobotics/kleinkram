import type {
    AccessGroupDto,
    DeleteAccessGroupResponseDto,
    GroupMembershipDto,
    ProjectAccessDto,
    ProjectAccessListDto,
    ProjectDto,
    RemoveAccessGroupFromProjectResponseDto,
} from '@kleinkram/api-dto';
import { AccessGroupRights } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const addUsersToProject = async (
    userUUId: string,
    projectUUID: string,
    rights: AccessGroupRights,
) => {
    const { data } = await axios.post<ProjectDto>(
        `/projects/${projectUUID}/users`,
        {
            userUuid: userUUId,
            rights,
        },
    );
    return data;
};

export const createAccessGroup = async (name: string) => {
    const { data } = await axios.post<AccessGroupDto>('/access-groups', {
        name,
    });
    return data;
};

/**
 * Adds all users in one request: either all of them are added or none.
 */
export const addUsersToAccessGroup = async (
    userUuids: string[],
    accessGroupUUID: string,
    canEditGroup = false,
    expireDate?: Date | 'never',
) => {
    const { data } = await axios.post<AccessGroupDto>(
        `/access-groups/${accessGroupUUID}/users`,
        {
            userUuids,
            canEditGroup,
            expireDate,
        },
    );
    return data;
};

/**
 * Adds the access group to all projects in one request: either it is added
 * to all of them or to none.
 */
export const addAccessGroupToProjects = async (
    accessGroupUUID: string,
    projects: { projectUuid: string; rights: AccessGroupRights }[],
) => {
    const { data } = await axios.post<ProjectDto[]>(
        `/access-groups/${accessGroupUUID}/projects`,
        {
            projects,
        },
    );
    return data;
};

export const updateProjectAccessRights = async (
    projectUuid: string,
    accessRights: ProjectAccessDto[],
) => {
    const { data } = await axios.post<ProjectAccessListDto>(
        `/projects/${projectUuid}/access`,
        accessRights,
    );
    return data;
};

export const removeAccessGroupFromProject = async (
    projectUUID: string,
    accessGroupUUID: string,
) => {
    const { data } =
        await axios.delete<RemoveAccessGroupFromProjectResponseDto>(
            `/access-groups/${accessGroupUUID}/projects/${projectUUID}`,
        );
    return data;
};

export const removeUsersFromAccessGroup = async (
    userUuids: string[],
    accessGroupUUID: string,
) => {
    const { data } = await axios.delete<AccessGroupDto>(
        `/access-groups/${accessGroupUUID}/users`,
        {
            data: { userUuids },
        },
    );
    return data;
};

export const deleteAccessGroup = async (accessGroupUUID: string) => {
    const { data } = await axios.delete<DeleteAccessGroupResponseDto>(
        `/access-groups/${accessGroupUUID}`,
    );
    return data;
};

export const setAccessGroupExpiry = async (
    uuid: string,
    userUuid: string,
    expiryDate: Date | null,
) => {
    const { data } = await axios.put<GroupMembershipDto>(
        `/access-groups/${uuid}/users/${userUuid}/expiration`,
        {
            expireDate: expiryDate ?? 'never',
        },
    );
    return data;
};

export const setAccessGroupUserPermissions = async (
    uuid: string,
    userUuid: string,
    canEditGroup: boolean,
) => {
    const { data } = await axios.put<GroupMembershipDto>(
        `/access-groups/${uuid}/users/${userUuid}/permissions`,
        { canEditGroup },
    );
    return data;
};
