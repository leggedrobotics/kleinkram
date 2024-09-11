import { FileEntity } from 'src/types/FileEntity';
import axios from 'src/api/axios';
import { Credentials } from 'minio';

// define type for generateTemporaryCredentials 'files' return
export type GenerateTemporaryCredentialsResponse = {
    credentials: Credentials;
    files: Record<
        string,
        {
            bucket: string;
            location: string;
            fileUUID: string;
            queueUUID: string;
            success: boolean;
        }
    >;
};

export const updateFile = async ({ file }: { file: FileEntity }) => {
    const response = await axios.put(`/file/${file.uuid}`, {
        uuid: file.uuid,
        filename: file.filename,
        mission_uuid: file.mission?.uuid,
        project_uuid: file.mission?.project?.uuid,
        date: file.date,
    });
    return response.data;
};

export const deleteFile = async (file: FileEntity) => {
    const response = await axios.delete(`/file/${file.uuid}`);
    return response.data;
};

export const generateTemporaryCredentials = async (
    filenames: Record<string, Record<string, string>>,
    missionUUID,
): GenerateTemporaryCredentialsResponse => {
    const response = await axios.post('/file/temporaryAccess', {
        filenames,
        missionUUID,
    });
    return response.data;
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
