import type { ProjectAccessDto } from '@kleinkram/api-dto/types/access-control/project-access.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const addUsersToProject = async (
    userUUId: string,
    projectUUID: string,
    rights: AccessGroupRights,
) => {
    const response = await axios.post('/access/addUserToProject', {
        userUUID: userUUId,
        uuid: projectUUID,
        rights,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const createAccessGroup = async (name: string) => {
    const response = await axios.post('/access/create', {
        name,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const addUserToAccessGroup = async (
    userUUID: string,
    accessGroupUUID: string,
) => {
    const response = await axios.post('/access/addUserToAccessGroup', {
        userUUID,
        uuid: accessGroupUUID,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const addAccessGroupToProject = async (
    projectUUID: string,
    accessGroupUUID: string,
    rights: AccessGroupRights,
) => {
    const response = await axios.post('/access/addAccessGroupToProject', {
        uuid: projectUUID,
        accessGroupUUID,
        rights,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateProjectAccessRights = async (
    projectUuid: string,
    accessRights: ProjectAccessDto[],
) => {
    const response = await axios.post(
        `/projects/${projectUuid}/access`,
        accessRights,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const removeAccessGroupFromProject = async (
    projectUUID: string,
    accessGroupUUID: string,
) => {
    const response = await axios.post('/access/removeAccessGroupFromProject', {
        uuid: projectUUID,
        accessGroupUUID,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const removeUsersFromAccessGroup = async (
    userUuids: string[],
    accessGroupUUID: string,
) => {
    const response = await axios.delete(`/access/${accessGroupUUID}/users`, {
        data: { userUuids },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteAccessGroup = async (accessGroupUUID: string) => {
    const response = await axios.delete(`/access/${accessGroupUUID}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const setAccessGroupExpiry = async (
    uuid: string,
    userUuid: string,
    expiryDate: Date | null,
) => {
    const response = await axios.post('/access/setExpireDate', {
        uuid,
        userUuid,
        expireDate: expiryDate ?? 'never',
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
