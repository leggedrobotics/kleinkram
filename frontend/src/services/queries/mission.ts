import { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { MissionsDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { AxiosResponse } from 'axios';
import qs from 'qs';
import axios from 'src/api/axios';

export const getMission = async (
    uuid: string | undefined,
): Promise<MissionWithFilesDto> => {
    const response: AxiosResponse<MissionWithFilesDto> =
        await axios.get<MissionWithFilesDto>('/mission/one', {
            params: { uuid },
        });
    return response.data;
};

export const missionsOfProjectMinimal = async (
    projectUUID: string,
    take = 100,
    skip = 0,
    sortBy = 'createdAt',
    descending = false,
    searchParameters?: {
        name: string;
    },
): Promise<MissionsDto> => {
    if (!projectUUID) {
        return {
            data: [],
            count: 0,
            take,
            skip,
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParameters?.name) {
        parameters.search = searchParameters.name;
    }
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        `/mission/filteredMinimal`,
        {
            params: parameters,
        },
    );
    return response.data;
};

export const missionsOfProject = async (
    projectUUID: string,
    take = 100,
    skip = 0,
    sortBy = 'createdAt',
    descending = false,
    searchParameters?: {
        name: string;
    },
): Promise<MissionsDto> => {
    if (!projectUUID) {
        return {
            data: [],
            count: 0,
            take,
            skip,
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParameters?.name) {
        parameters.search = searchParameters.name;
    }
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        `/mission/filtered`,
        {
            params: parameters,
        },
    );
    return response.data;
};

export const getMissions = async (uuids: string[]): Promise<MissionsDto> => {
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        '/mission',
        {
            params: { missionUuids: uuids },
            paramsSerializer: (parameters) => {
                return qs.stringify(parameters, {
                    arrayFormat: 'repeat',
                });
            },
        },
    );
    return response.data;
};
