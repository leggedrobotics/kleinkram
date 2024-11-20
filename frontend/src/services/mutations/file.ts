import { FileEntity } from 'src/types/FileEntity';
import axios from 'src/api/axios';

// define type for generateTemporaryCredentials 'files' return
export type GenerateTemporaryCredentialsResponse = {
    bucket: string;
    fileUUID: string;
    accessCredentials: {
        accessKey: string;
        secretKey: string;
        sessionToken: string;
    } | null;
}[];

export const updateFile = async ({ file }: { file: FileEntity }) => {
    const response = await axios.put(`/file/${file.uuid}`, {
        uuid: file.uuid,
        filename: file.filename,

        mission_uuid: file.mission?.uuid,
        date: file.date,
        categories: file.categories.map((category) => category.uuid),
    });
    return response.data;
};

export const moveFiles = async (fileUUIDs: string[], missionUUID: string) => {
    const response = await axios.post('/file/moveFiles', {
        fileUUIDs,
        missionUUID,
    });
    return response.data;
};

export const deleteFile = async (file: FileEntity) => {
    const response = await axios.delete(`/file/${file.uuid}`);
    return response.data;
};

export const generateTemporaryCredentials = async (
    filenames: string[],
    missionUUID: string,
): Promise<GenerateTemporaryCredentialsResponse> => {
    const response = await axios.post('/file/temporaryAccess', {
        filenames,
        missionUUID,
    });
    return response.data as GenerateTemporaryCredentialsResponse;
};

export const cancelUploads = async (
    fileUUIDs: string[],
    missionUUID: string,
) => {
    const response = await axios.post('/file/cancelUpload', {
        uuids: fileUUIDs,
        missionUUID,
    });
    return response.data;
};

export const deleteFiles = async (fileUUIDs: string[], missionUUID: string) => {
    const response = await axios.post('/file/deleteMultiple', {
        uuids: fileUUIDs,
        missionUUID,
    });
    return response.data;
};
