import axios from 'src/api/axios';

import { FileWithTopicDto } from '@api/types/file/file.dto';

export const confirmUpload = async (uuid: string, md5: string) => {
    const response = await axios.post('/queue/confirmUpload', { uuid, md5 });
    return response.data;
};

export const createFile = async (
    name: string,
    missionUUID: string,
    file: File,
): Promise<FileWithTopicDto> => {
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
    const response = await axios.post('/queue/import_from_drive', {
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
export const cancelProcessing = async (
    queueUUID: string,
    missionUUID: string,
) => {
    const response = await axios.post(`/queue/cancelProcessing`, {
        queueUUID,
        missionUUID,
    });
    return response.data;
};

export const stopQueue = async (queueUUID: string) => {
    const response = await axios.post(`/queue/stopJob`, { jobId: queueUUID });
    return response.data;
};
