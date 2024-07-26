import axios from 'src/api/axios';
import { Project } from 'src/types/Project';

export const createProject = async (
    name: string,
    description: string,
    requiredTags: string[],
) => {
    const response = await axios.post('/project/create', {
        name,
        description,
        requiredTags,
    });
    return response.data;
};

export const updateProject = async (
    projectUUID: string,
    name: string,
    description: string,
) => {
    const response = await axios.put(
        '/project/update',
        { name, description },
        { params: { uuid: projectUUID } },
    );
    return response.data as Project;
};

export const deleteProject = async (projectUUID: string) => {
    const response = await axios.delete('/project/delete', {
        params: { uuid: projectUUID },
    });
    return response.data;
};
