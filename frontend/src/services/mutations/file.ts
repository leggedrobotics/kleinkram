import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { TemporaryFileAccessesDto } from '@kleinkram/api-dto/types/file/access.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { TemporaryAccessRequestDto } from '@kleinkram/api-dto/types/file/temporary-access-request.dto';
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

export const updateFile = async ({ file }: { file: FileWithTopicDto }) => {
    const response = await axios.put(`/files/${file.uuid}`, {
        uuid: file.uuid,
        missionUuid: file.missionUUID,
        filename: file.filename,
        date: file.date,
        categories: file.categories.map(
            (category: CategoryDto) => category.uuid,
        ),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const moveFiles = async (fileUUIDs: string[], missionUUID: string) => {
    const response = await axios.post('/files/moveFiles', {
        fileUUIDs,
        missionUUID,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteFile = async (file: FileWithTopicDto) => {
    const response = await axios.delete(`/files/${file.uuid}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const generateTemporaryCredentials = async (
    payload: TemporaryAccessRequestDto,
): Promise<TemporaryFileAccessesDto> => {
    const response = await axios.post('/files/temporaryAccess', payload);
    return response.data as TemporaryFileAccessesDto;
};

export const cancelUploads = async (
    fileUuids: string[],
    missionUuid: string,
): Promise<void> => {
    const response = await axios.post('/files/cancelUpload', {
        uuids: fileUuids,
        missionUuid: missionUuid,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const deleteFiles = async (fileUUIDs: string[], missionUUID: string) => {
    const response = await axios.post('/files/deleteMultiple', {
        uuids: fileUUIDs,
        missionUUID,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
