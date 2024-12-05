import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { ActionDto, ActionsDto } from '@api/types/actions/action.dto';

export const getActions = async (
    projectUUID: string,
    missionUUID: string,
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
    search: string,
): Promise<ActionsDto> => {
    const parameters: Record<string, string | number | boolean> = {
        project_uuid: projectUUID,
        mission_uuid: missionUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };

    if (search) {
        parameters.search = search;
    }

    const response: AxiosResponse<ActionsDto> = await axios.get<ActionsDto>(
        '/action/listActions',
        { params: parameters },
    );
    return response.data;
};

export const actionDetails = async (actionUuid: string) => {
    const parameters = {
        uuid: actionUuid,
    };

    const response = await axios.get('/action/details', { params: parameters });
    return response.data;
};

export const listActionTemplates = async (search: string) => {
    const parameters: Record<string, string> = {};
    if (search) {
        parameters.search = search;
    }
    const response = await axios.get('/action/listTemplates', {
        params: parameters,
    });
    return response.data;
};

export const getRunningActions = async (): Promise<ActionDto> => {
    const response: AxiosResponse<ActionDto> = await axios.get(
        '/action/running',
        {
            params: { skip: 0, take: 10 },
        },
    );

    return response.data;
};
