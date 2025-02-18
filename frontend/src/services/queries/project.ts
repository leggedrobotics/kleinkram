import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { DefaultRights } from '@api/types/access-control/default-rights';
import { ResentProjectsDto } from '@api/types/project/recent-projects.dto';
import { ProjectsDto } from '@api/types/project/projects.dto';
import { ProjectWithMissionsDto } from '@api/types/project/project-with-missions.dto';

export const filteredProjects = async (
    take: number,
    skip: number,
    sortBy: string,
    descending = false,
    searchParameters?: Record<string, string>,
): Promise<ProjectsDto> => {
    const parameters: Record<string, string> = {
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParameters && Object.keys(searchParameters).length > 0) {
        parameters.searchParams = searchParameters;
    }
    const response: AxiosResponse<ProjectsDto> = await axios.get<ProjectsDto>(
        '/oldProject/filtered',
        {
            params: parameters,
        },
    );
    return response.data;
};

export const getProject = async (
    uuid: string,
): Promise<ProjectWithMissionsDto> => {
    const response: AxiosResponse<ProjectWithMissionsDto> =
        await axios.get<ProjectWithMissionsDto>(`/projects/${uuid}`);
    return response.data;
};

export const getProjectDefaultAccess = async (): Promise<DefaultRights> => {
    const response: AxiosResponse<DefaultRights> = await axios.get(
        '/oldProject/getDefaultRights',
    );
    return response.data;
};

export const recentProjects = async (
    take: number,
): Promise<ResentProjectsDto> => {
    const response = await axios.get<ResentProjectsDto>('/oldProject/recent', {
        params: { take },
    });
    return response.data;
};
