import axios from 'src/api/axios';
import { MissionDto, MissionsDto } from '@api/types/Mission.dto';
import { AxiosResponse } from 'axios';

export const getMission = async (uuid: string): Promise<MissionDto> => {
    const response: AxiosResponse<MissionDto> = await axios.get<MissionDto>(
        '/mission/one',
        { params: { uuid } },
    );
    return response.data;
};

export const missionsOfProjectMinimal = async (
    projectUUID: string,
    take = 100,
    skip = 0,
    sortBy = 'createdAt',
    descending = false,
    searchParams?: {
        name: string;
    },
): Promise<MissionsDto> => {
    if (!projectUUID) {
        return {
            missions: [],
            count: 0,
        };
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams?.name) {
        params.search = searchParams.name;
    }
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        `/mission/filteredMinimal`,
        {
            params,
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
    searchParams?: {
        name: string;
    },
): Promise<MissionsDto> => {
    if (!projectUUID) {
        return {
            missions: [],
            count: 0,
        };
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams?.name) {
        params.search = searchParams.name;
    }
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        `/mission/filtered`,
        {
            params,
        },
    );
    return response.data;
};

export const getMissions = async (uuids: string[]): Promise<MissionsDto> => {
    const response: AxiosResponse<MissionsDto> = await axios.get<MissionsDto>(
        '/mission/many',
        { params: { uuids } },
    );
    return response.data;
};
