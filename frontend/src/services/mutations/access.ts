import { ProjectAccessDto } from '@api/types/access-control/project-access.dto';
import { AccessGroupRights } from '@common/enum';
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
    return response.data;
};

export const createAccessGroup = async (name: string) => {
    const response = await axios.post('/access/create', {
        name,
    });
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
    return response.data;
};

export const removeUserFromAccessGroup = async (
    userUUID: string,
    accessGroupUUID: string,
) => {
    const response = await axios.post('/access/removeUserFromAccessGroup', {
        userUUID,
        uuid: accessGroupUUID,
    });
    return response.data;
};

export const deleteAccessGroup = async (accessGroupUUID: string) => {
    const response = await axios.delete(`/access/${accessGroupUUID}`);
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
    return response.data;
};
