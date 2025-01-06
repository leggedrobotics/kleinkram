import axios from 'src/api/axios';
import { AccessGroupRights } from '@common/enum';

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

export const updateProjectAccess = async (
    projectUUID: string,
    groupUuid: string,
    rights: AccessGroupRights,
) => {
    const response = await axios.post('/access/updateProjectAccess', {
        accessGroupUUID: groupUuid,
        rights,
        uuid: projectUUID,
    });
    return response.data;
};

export const setAccessGroupExpiry = async (
    uuid: string,
    expiryDate: Date | null,
) => {
    const response = await axios.post('/access/setExpireDate', {
        uuid,
        expireDate: expiryDate ?? 'never',
    });
    return response.data;
};
