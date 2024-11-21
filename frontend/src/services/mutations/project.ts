import axios from 'src/api/axios';
import { AccessGroupRights } from '@common/enum';

export const createProject = async (
    name: string,
    description: string,
    requiredTags: string[],
    accessGroups: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUUID: string; rights: AccessGroupRights }
    )[],
    removedDefaultGroups: string[],
) => {
    const response = await axios.post('/project/create', {
        name,
        description,
        requiredTags,
        accessGroups,
        removedDefaultGroups,
    });
    return response.data;
};

export const updateProject = async (
    projectUUID: string,
    name: string,
    description: string,
) => {
    const response = await axios.put(`/project/${projectUUID}`, {
        name,
        description,
    });
    return response.data as Project;
};

export const deleteProject = async (projectUUID: string) => {
    const response = await axios.delete(`/project/${projectUUID}`);
    return response.data;
};

export const updateTagTypes = async (
    projectUUID: string,
    tagTypeUUIDs: string[],
) => {
    const response = await axios.post(
        '/project/updateTagTypes',
        { tagTypeUUIDs },
        {
            params: { uuid: projectUUID },
        },
    );
    return response.data;
};
