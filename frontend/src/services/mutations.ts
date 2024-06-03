import axios from 'src/api/axios';
import { FileEntity, Project } from 'src/types/types';

export const createProject = async (name: string, description: string) => {
    const response = await axios.post('/project/create', { name, description });
    return response.data;
};

export const createMission = async (name: string, projectUUID: string) => {
    const response = await axios.post('/mission/create', { name, projectUUID });
    return response.data;
};

export const createAnalysis = async (
    docker_image: string,
    missionUUID: string,
) => {
    const response = await axios.post('/action/submit', {
        missionUUID,
        docker_image,
    });
    return response.data;
};

export const getUploadURL = async (
    filenames: string[],
    missionUUID: string,
) => {
    const response = await axios.post('/queue/createPreSignedURLS', {
        filenames,
        missionUUID,
    });
    return response.data;
};

export const confirmUpload = async (filename: string) => {
    const response = await axios.post('/queue/confirmUpload', { filename });
    return response.data;
};

export const createFile = async (
    name: string,
    missionUUID: string,
    file: File,
): Promise<FileEntity> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('missionUUID', missionUUID);
    formData.append('file', file);

    const response = await axios.post('/queue/create', formData, {
        headers: {},
    });

    return response.data;
};

export const createDrive = async (missionUUID: string, driveURL: string) => {
    const response = await axios.post('/queue/createdrive', {
        missionUUID,
        driveURL,
    });
    return response.data;
};

export const updateFile = async (file: FileEntity) => {
    const response = await axios.put(`/file/${file.uuid}`, file);
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

export const moveMission = async (missionUUID: string, projectUUID: string) => {
    const response = await axios.post(
        '/mission/move',
        {},
        { params: { missionUUID, projectUUID } },
    );
    return response.data;
};
