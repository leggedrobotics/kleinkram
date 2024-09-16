import axios from 'src/api/axios';
import { FileEntity } from 'src/types/FileEntity';

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

export const deleteFile = async (missionUUID: string, queueUUID: string) => {
    const response = await axios.delete(`/queue/${queueUUID}`, {
        data: { missionUUID },
    });
    return response.data;
};
export const cancelProcessing = async (queueUUID: string, missionUUID) => {
    const response = await axios.post(`/queue/cancelProcessing`, {
        queueUUID,
        missionUUID,
    });
    return response.data;
};
