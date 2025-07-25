import { AccessGroupRights } from '@common/enum';
import axios from 'src/api/axios';

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
    const response = await axios.post('/projects', {
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
    autoConvert: boolean,
) => {
    const response = await axios.put(`/projects/${projectUUID}`, {
        name,
        description,
        autoConvert,
    });
    return response.data;
};

export const deleteProject = async (projectUUID: string) => {
    const response = await axios.delete(`/projects/${projectUUID}`);
    return response.data;
};

export const updateTagTypes = async (
    projectUUID: string,
    tagTypeUUIDs: string[],
) => {
    const response = await axios.post(
        `/projects/${projectUUID}/updateTagTypes`,
        { tagTypeUUIDs },
    );
    return response.data;
};
