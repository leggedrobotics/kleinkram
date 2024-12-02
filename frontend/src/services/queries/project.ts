import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { DefaultRightsDto } from '@api/types/DefaultRights.dto';
import { ResentProjectsDto } from '@api/types/RecentProjects.dto';
import { ProjectDto, ProjectsDto } from '@api/types/Project.dto';

export const filteredProjects = async (
    take: number,
    skip: number,
    sortBy: string,
    descending = false,
    searchParams?: Record<string, string>,
): Promise<ProjectsDto> => {
    const params: Record<string, any> = {
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams && Object.keys(searchParams).length > 0) {
        params.searchParams = searchParams;
    }
    const response: AxiosResponse<ProjectsDto> = await axios.get<ProjectsDto>(
        '/project/filtered',
        {
            params,
        },
    );
    return response.data;
};

export const getProject = async (uuid: string): Promise<ProjectDto> => {
    const response: AxiosResponse<ProjectDto> = await axios.get<ProjectDto>(
        '/project/one',
        { params: { uuid } },
    );
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
