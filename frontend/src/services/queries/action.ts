import axios from 'src/api/axios';

export const getActions = async (
    projectUUID: string,
    missionUUID: string,
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
    search: string,
): Promise<[Action[], number]> => {
    const params: Record<string, string | number | boolean> = {
        project_uuid: projectUUID,

        mission_uuid: missionUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };

    if (search) {
        params.search = search;
    }

    const response = await axios.get('/action/listActions', { params });
    return response.data;
};

export const actionDetails = async (actionUuid: string) => {
    const params = {
        uuid: actionUuid,
    };

    const response = await axios.get('/action/details', { params });
    return response.data;
};

export const listActionTemplates = async (search: string) => {
    const params: Record<string, string> = {};
    if (search) {
        params.search = search;
    }
    const response = await axios.get('/action/listTemplates', {
        params,
    });
    return response.data;
};

export const getRunningActions = async () => {
    const response = await axios.get('/action/running', {
        params: { skip: 0, take: 10 },
    });
    return response.data;
};
