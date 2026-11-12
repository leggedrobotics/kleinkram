import type { DefaultRights } from '@kleinkram/api-dto/types/access-control/default-rights';
import type { ProjectWithRequiredMetadataTypesDto } from '@kleinkram/api-dto/types/project/project-with-required-metadata-types.dto';
import type { ProjectsDto } from '@kleinkram/api-dto/types/project/projects.dto';
import type { ResentProjectsDto } from '@kleinkram/api-dto/types/project/recent-projects.dto';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

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
        sortBy: sortBy,
        sortOrder: descending ? 'DESC' : 'ASC',
    };
    if (searchParameters && 'name' in searchParameters) {
        parameters.projectPatterns = searchParameters.name;
    }

    if (searchParameters && 'creator.uuid' in searchParameters) {
        parameters.creatorUuid = searchParameters['creator.uuid'];
    }

    if (searchParameters?.starred === 'true') {
        parameters.starred = 'true';
    }

    if (searchParameters?.public === 'true') {
        parameters.public = 'true';
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
): Promise<ProjectWithRequiredMetadataTypesDto> => {
    const response: AxiosResponse<ProjectWithRequiredMetadataTypesDto> =
        await axios.get<ProjectWithRequiredMetadataTypesDto>(
            `/projects/${uuid}`,
        );
    return response.data;
};

export const getProjectDefaultAccess = async (): Promise<DefaultRights> => {
    const response: AxiosResponse<DefaultRights> = await axios.get(
        '/projects/default-rights',
    );
    return response.data;
};

export const recentProjects = async (
    take: number,
): Promise<ResentProjectsDto> => {
    const response = await axios.get<ResentProjectsDto>('/projects/recent', {
        params: { take },
    });
    return response.data;
};

export const starredProjects = async (take: number): Promise<ProjectsDto> => {
    const response: AxiosResponse<ProjectsDto> = await axios.get<ProjectsDto>(
        '/projects',
        {
            params: {
                take: take.toString(),
                skip: '0',
                sortBy: 'name',
                sortOrder: 'ASC',
                starred: 'true',
            },
        },
    );
    return response.data;
};
