import axios from 'src/api/axios';
import { DataType } from 'src/enum/TAG_TYPES';
import { FileEntity } from 'src/types/FileEntity';
import { Project } from 'src/types/Project';
import { Tag } from 'src/types/Tag';
import { AccessGroupRights } from 'src/enum/ACCESS_RIGHTS';

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

export const createMission = async (
    name: string,
    projectUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/mission/create', {
        name,
        projectUUID,
        tags,
    });
    return response.data;
};

export const removeTag = async (tagUUID: string) => {
    const response = await axios.delete('/tag/deleteTag', {
        params: { uuid: tagUUID },
    });
    return response.data;
};

export const addTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/tag/addTags', {
        mission: missionUUID,
        tags,
    });
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

export const confirmUpload = async (uuid: string) => {
    const response = await axios.post('/queue/confirmUpload', { uuid });
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

export const updateFile = async ({ file }: { file: FileEntity }) => {
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

export const createTagType = async (name: string, type: DataType) => {
    const response = await axios.post('/tag/create', { name, type });
    return new Tag(
        response.data.uuid,
        response.data.STRING,
        response.data.NUMBER,
        response.data.BOOLEAN,
        response.data.DATE,
        response.data.LOCATION,
        response.data.type,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
        new Date(response.data.deletedAt),
    );
};

export const addUsersToProject = async (
    userUUId: string,
    projectUUID: string,
    rights: AccessGroupRights,
) => {
    const response = await axios.post('/access/addUserToProject', {
        userUUID: userUUId,
        uuid: projectUUID,
        rights,
    });
    return response.data;
};

export const createAccessGroup = async (name: string) => {
    const response = await axios.post('/access/createAccessGroup', {
        name,
    });
    return response.data;
};

export const addUserToAccessGroup = async (
    userUUID: string,
    accessGroupUUID: string,
) => {
    const response = await axios.post('/access/addUserToAccessGroup', {
        userUUID,
        uuid: accessGroupUUID,
    });
    return response.data;
};

export const addAccessGroupToProject = async (
    projectUUID: string,
    accessGroupUUID: string,
    rights: AccessGroupRights,
) => {
    const response = await axios.post('/access/addAccessGroupToProject', {
        uuid: projectUUID,
        accessGroupUUID,
        rights,
    });
    return response.data;
};
