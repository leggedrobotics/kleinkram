import type { CancelProcessingResponseDto } from '@kleinkram/api-dto/types/cancel-processing-response.dto';
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { ConfirmUploadDto } from '@kleinkram/api-dto/types/confirm-upload.dto';
import type { DeleteMissionResponseDto } from '@kleinkram/api-dto/types/delete-mission-response.dto';
import type { DriveImportResponseDto } from '@kleinkram/api-dto/types/drive-import-response.dto';
import type { TemporaryFileAccessesDto } from '@kleinkram/api-dto/types/file/access.dto';
import type { CancelUploadResponseDto } from '@kleinkram/api-dto/types/file/cancel-upload-response.dto';
import type { DeleteFileResponseDto } from '@kleinkram/api-dto/types/file/delete-file-response.dto';
import type { FileQueueEntriesDto } from '@kleinkram/api-dto/types/file/file-queue-entry.dto';
import type {
    FileDto,
    FileWithTopicDto,
} from '@kleinkram/api-dto/types/file/file.dto';
import type { MoveFilesResponseDto } from '@kleinkram/api-dto/types/file/move-files-response.dto';
import type { TemporaryAccessRequestDto } from '@kleinkram/api-dto/types/file/temporary-access-request.dto';
import type { StopJobResponseDto } from '@kleinkram/api-dto/types/queue/stop-job-response.dto';
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

export const updateFile = async ({
    file,
}: {
    file: FileWithTopicDto;
}): Promise<FileDto> => {
    const response = await axios.put<FileDto>(`/files/${file.uuid}`, {
        uuid: file.uuid,
        missionUuid: file.missionUUID,
        filename: file.filename,
        date: file.date,
        categories: file.categories.map(
            (category: CategoryDto) => category.uuid,
        ),
    });
    return response.data;
};

export const moveFiles = async (
    fileUUIDs: string[],
    missionUUID: string,
): Promise<MoveFilesResponseDto> => {
    const response = await axios.post<MoveFilesResponseDto>(
        '/files/moveFiles',
        {
            fileUUIDs,
            missionUUID,
        },
    );
    return response.data;
};

export const deleteFile = async (
    file: FileWithTopicDto,
): Promise<DeleteFileResponseDto> => {
    const response = await axios.delete<DeleteFileResponseDto>(
        `/files/${file.uuid}`,
    );
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
): Promise<CancelUploadResponseDto> => {
    const response = await axios.post<CancelUploadResponseDto>(
        '/files/cancelUpload',
        {
            uuids: fileUuids,
            missionUuid: missionUuid,
        },
    );
    return response.data;
};

export const deleteFiles = async (
    fileUUIDs: string[],
    missionUUID: string,
): Promise<DeleteFileResponseDto> => {
    const response = await axios.post<DeleteFileResponseDto>(
        '/files/deleteMultiple',
        {
            uuids: fileUUIDs,
            missionUUID,
        },
    );
    return response.data;
};

export const getQueue = async (
    startDate: string,
    stateFilter: string[],
    pagination: { skip: number; take: number },
): Promise<FileQueueEntriesDto> => {
    const response = await axios.get<FileQueueEntriesDto>('/files/queue', {
        params: {
            startDate,
            stateFilter: stateFilter.join(','),
            skip: pagination.skip,
            take: pagination.take,
        },
    });
    return response.data;
};

export const deleteQueueItem = async (
    missionUUID: string,
    queueUUID: string,
): Promise<DeleteMissionResponseDto> => {
    const response = await axios.delete<DeleteMissionResponseDto>(
        `/files/queue/${queueUUID}`,
        {
            data: { missionUUID },
        },
    );
    return response.data;
};

export const cancelProcessing = async (
    queueUUID: string,
    missionUUID: string,
): Promise<CancelProcessingResponseDto> => {
    const response = await axios.post<CancelProcessingResponseDto>(
        `/files/queue/${queueUUID}/cancel`,
        {
            missionUUID,
        },
    );
    return response.data;
};

export const stopQueueItem = async (
    queueUUID: string,
): Promise<StopJobResponseDto> => {
    const response = await axios.post<StopJobResponseDto>(
        `/files/queue/${queueUUID}/stop`,
    );
    return response.data;
};

export const confirmUpload = async (
    uuid: string,
    md5: string,
): Promise<ConfirmUploadDto> => {
    const response = await axios.post<ConfirmUploadDto>(
        '/files/upload/confirm',
        {
            uuid,
            md5,
        },
    );
    return response.data;
};

export const importFromDrive = async (
    missionUUID: string,
    driveURL: string,
): Promise<DriveImportResponseDto> => {
    const response = await axios.post<DriveImportResponseDto>(
        '/files/import/drive',
        {
            missionUUID,
            driveURL,
        },
    );
    return response.data;
};
