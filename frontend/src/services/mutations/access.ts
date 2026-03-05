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
    const { data } = await axios.post<ProjectAccessDto>(
        `/projects/${projectUUID}/users`,
        {
            userUuid: userUUId,
            rights,
        },
    );
    return data;
};

export const createAccessGroup = async (name: string) => {
    const { data } = await axios.post<AccessGroupDto>('/access', {
        name,
    });
    return data;
};

export const addUserToAccessGroup = async (
    userUuid: string,
    accessGroupUUID: string,
) => {
    const { data } = await axios.post<AccessGroupDto>(
        `/access/${accessGroupUUID}/users`,
        {
            userUuid,
        },
    );
    return data;
};

export const addAccessGroupToProject = async (
    projectUUID: string,
    accessGroupUUID: string,
    rights: AccessGroupRights,
) => {
    const { data } = await axios.post<ProjectDto>(
        `/access/${accessGroupUUID}/projects/${projectUUID}`,
        {
            rights,
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
            `/access/${accessGroupUUID}/projects/${projectUUID}`,
        );
    return data;
};

export const removeUsersFromAccessGroup = async (
    userUuids: string[],
    accessGroupUUID: string,
) => {
    const { data } = await axios.delete<AccessGroupDto>(
        `/access/${accessGroupUUID}/users`,
        {
            data: { userUuids },
        },
    );
    return data;
};

export const deleteAccessGroup = async (accessGroupUUID: string) => {
    const { data } = await axios.delete<DeleteAccessGroupResponseDto>(
        `/access/${accessGroupUUID}`,
    );
    return data;
};

export const setAccessGroupExpiry = async (
    uuid: string,
    userUuid: string,
    expiryDate: Date | null,
) => {
    const { data } = await axios.put<GroupMembershipDto>(
        `/access/${uuid}/users/${userUuid}/expiration`,
        {
            expireDate: expiryDate ?? 'never',
        },
    );
    return data;
};
