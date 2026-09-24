import type { ProjectArchiveStatusDto } from '@kleinkram/api-dto/types/project/project-archive.dto';
import type { ProjectStarDto } from '@kleinkram/api-dto/types/project/project-star.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const createProject = async (
    name: string,
    description: string,
    requiredMetadataTypes: string[],
    accessGroups: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUUID: string; rights: AccessGroupRights }
    )[],
    removedDefaultGroups: string[],
) => {
    const response = await axios.post('/projects', {
        name,
        description,
        requiredMetadataTypes,
        accessGroups,
        removedDefaultGroups,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateProject = async (
    projectUUID: string,
    name: string,
    description: string,
    autoConvert: boolean,
) => {
    const response = await axios.put(`/projects/${projectUUID}`, {
        name,
        description,
        autoConvert,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteProject = async (projectUUID: string) => {
    const response = await axios.delete(`/projects/${projectUUID}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateProjectMetadataTypes = async (
    projectUUID: string,
    metadataTypeUUIDs: string[],
) => {
    const response = await axios.put(
        `/projects/${projectUUID}/metadata-types`,
        { metadataTypeUUIDs },
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const starProject = async (
    projectUUID: string,
): Promise<ProjectStarDto> => {
    const response = await axios.post<ProjectStarDto>(
        `/projects/${projectUUID}/star`,
    );
    return response.data;
};

export const unstarProject = async (
    projectUUID: string,
): Promise<ProjectStarDto> => {
    const response = await axios.delete<ProjectStarDto>(
        `/projects/${projectUUID}/star`,
    );
    return response.data;
};

export const archiveProject = async (
    projectUUID: string,
    reason?: string,
): Promise<ProjectArchiveStatusDto> => {
    const response = await axios.post<ProjectArchiveStatusDto>(
        `/projects/${projectUUID}/archive`,
        { reason },
    );
    return response.data;
};

export const restoreProject = async (
    projectUUID: string,
    reason: string,
): Promise<ProjectArchiveStatusDto> => {
    const response = await axios.post<ProjectArchiveStatusDto>(
        `/projects/${projectUUID}/archive/restore`,
        { reason },
    );
    return response.data;
};
