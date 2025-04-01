import axios from 'src/api/axios';
import { CategoryDto } from '@api/types/category.dto';
import { FileWithTopicDto } from '@api/types/file/file.dto';
import { TemporaryFileAccessesDto } from '@api/types/file/access.dto';

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

export const updateFile = async ({ file }: { file: FileWithTopicDto }) => {
    const response = await axios.put(`/file/${file.uuid}`, {
        uuid: file.uuid,
        mission_uuid: file.missionUUID,
        filename: file.filename,
        date: file.date,
        categories: file.categories.map(
            (category: CategoryDto) => category.uuid,
        ),
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

export const deleteFile = async (file: FileWithTopicDto) => {
    const response = await axios.delete(`/file/${file.uuid}`);
    return response.data;
};

export const generateTemporaryCredentials = async (
    filenames: string[],
    missionUUID: string,
): Promise<TemporaryFileAccessesDto> => {
    const response = await axios.post('/file/temporaryAccess', {
        filenames,
        missionUUID,
    });
    return response.data as TemporaryFileAccessesDto;
};

export const cancelUploads = async (
    fileUuids: string[],
    missionUuid: string,
): Promise<void> => {
    const response = await axios.post('/file/cancelUpload', {
        uuids: fileUuids,
        missionUuid: missionUuid,
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
