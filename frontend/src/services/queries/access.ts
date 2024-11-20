import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';
import { ProjectAccess } from 'src/types/ProjectAccess';

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
        params['search'] = search;
    }
    if (personal) {
        params['personal'] = true;
    }
    if (creator) {
        params['creator'] = true;
    }
    if (member) {
        params['member'] = true;
    }
    const response = await axios.get('/access/filtered', {
        params,
    });
    if (!response.data) {
        return [[], 0];
    }
    const data = response.data.entities;
    const total = response.data.total;
    const res = data.map((group: any) => AccessGroup.fromAPIResponse(group));
    return [res, total];
};

export const getAccessGroup = async (uuid: string): Promise<AccessGroup> => {
    const response = await axios.get(`/access/one`, { params: { uuid } });
    const group = response.data;
    return AccessGroup.fromAPIResponse(group);
};

export const getProjectAccess = async (
    projectUUID: string,
    projectAccessUUID: string,
): Promise<ProjectAccess> => {
    const response = await axios.get(`/access/projectAccess`, {
        params: { uuid: projectUUID, projectAccessUUID },
    });
    const access = response.data;
    console.log(`access: ${JSON.stringify(access)}`);
    const res = ProjectAccess.fromAPIResponse(access);
    console.log(`res: ${JSON.stringify(res)}`);
    return res;
};
