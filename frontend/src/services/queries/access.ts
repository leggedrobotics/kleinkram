import axios from 'src/api/axios';

export const canAddAccessGroup = async (
    projectUuid: string,
): Promise<boolean> => {
    if (!projectUuid) {
        return false;
    }
    const response = await axios.get('/access/canAddAccessGroupToProject', {
        params: { uuid: projectUuid },
    });

    return response.data;
};

export const searchAccessGroups = async (
    search: string,
    personal: boolean,
    creator: boolean,
    member: boolean,
    skip: number,
    take: number,
): Promise<[AccessGroup[], 0]> => {
    const params: Record<string, string | boolean | number> = {
        skip,
        take,
    };
    if (search) {
        params.search = search;
    }
    if (personal) {
        params.personal = true;
    }
    if (creator) {
        params.creator = true;
    }
    if (member) {
        params.member = true;
    }
    const response = await axios.get('/access/filtered', {
        params,
    });
    return response.data;
};

export const getAccessGroup = async (uuid: string): Promise<AccessGroup> => {
    const response = await axios.get(`/access/one`, { params: { uuid } });
    return response.data;
};

export const getProjectAccess = async (
    projectUUID: string,
    projectAccessUUID: string,
): Promise<ProjectAccess> => {
    const response = await axios.get(`/access/projectAccess`, {
        params: { uuid: projectUUID, projectAccessUUID },
    });
    return response.data;
};
