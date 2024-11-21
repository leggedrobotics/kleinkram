import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { DefaultRightsDto } from '@api/types/DefaultRights.dto';
import { ResentProjectsDto } from '@api/types/RecentProjects.dto';

export const filteredProjects = async (
    take: number,
    skip: number,
    sortBy: string,
    descending = false,
    searchParams?: Record<string, string>,
): Promise<[Project[], number]> => {
    const params: Record<string, any> = {
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams && Object.keys(searchParams).length > 0) {
        params.searchParams = searchParams;
    }
    const response = await axios.get('/project/filtered', {
        params,
    });
    return response.data;
};

export const getProject = async (uuid: string): Promise<Project> => {
    const response = await axios.get('/project/one', { params: { uuid } });
    return response.data;
};

export const getProjectDefaultAccess = async (): Promise<DefaultRightsDto> => {
    const response: AxiosResponse<DefaultRightsDto> = await axios.get(
        '/project/getDefaultRights',
    );
    return response.data;
};

export const recentProjects = async (
    take: number,
): Promise<ResentProjectsDto> => {
    const response = await axios.get<ResentProjectsDto>('/project/recent', {
        params: { take },
    });
    return response.data;
};
