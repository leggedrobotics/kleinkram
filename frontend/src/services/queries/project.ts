import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { DefaultRights } from '@api/types/access-control/default-rights';
import { ResentProjectsDto } from '@api/types/project/recent-projects.dto';
import { ProjectsDto } from '@api/types/project/projects.dto';
import { ProjectWithRequiredTags } from '@api/types/project/project-with-required-tags';

export const filteredProjects = async (
    take: number,
    skip: number,
    sortBy: string,
    descending = false,
    searchParameters?: Record<string, string>,
): Promise<ProjectsDto> => {
    const parameters: Record<string, string> = {
        take: take.toString(),
        skip: skip.toString(),
        sortBy: sortBy.toString(),
        sortOrder: descending ? 'DESC' : 'ASC',
    };
    if (searchParameters && 'name' in searchParameters) {
        parameters.projectPatterns = searchParameters.name;
    }

    if (searchParameters && 'creator.uuid' in searchParameters) {
        parameters.creatorUuid = searchParameters['creator.uuid'];
    }

    const response: AxiosResponse<ProjectsDto> = await axios.get<ProjectsDto>(
        '/projects',
        {
            params: parameters,
        },
    );
    return response.data;
};

export const getProject = async (
    uuid: string,
): Promise<ProjectWithRequiredTags> => {
    const response: AxiosResponse<ProjectWithRequiredTags> =
        await axios.get<ProjectWithRequiredTags>(`/projects/${uuid}`);
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
