import { FileExistsResponseDto } from '@kleinkram/api-dto/types/file/access.dto';
import { FileEventsDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import { FoxgloveLinkResponseDto } from '@kleinkram/api-dto/types/file/foxglove-link-response.dto';
import { IsUploadingDto } from '@kleinkram/api-dto/types/file/is-uploading.dto';
import { StorageOverviewDto } from '@kleinkram/api-dto/types/storage-overview.dto';
import { FileType, HealthStatus } from '@kleinkram/shared';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const fetchFilteredFiles = async (
    filename: string,
    projectUUID?: string,
    missionUUID?: string,
    startDate?: Date,
    endDate?: Date,
    topics?: string[],
    categories?: string[],
    matchAllTopics?: boolean,
    fileTypes?: FileType[],
    tag?: Record<string, unknown>,
    take?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    health?: HealthStatus,
): Promise<FilesDto> => {
    try {
        const parameters: Record<string, string> = {};
        if (filename) parameters.fileName = filename;
        if (projectUUID) parameters.projectUUID = projectUUID;
        if (missionUUID) parameters.missionUUID = missionUUID;
        if (startDate) parameters.startDate = startDate.toISOString();
        if (endDate) parameters.endDate = endDate.toISOString();
        if (topics && topics.length > 0) parameters.topics = topics.join(',');
        if (categories && categories.length > 0) {
            parameters.categories = categories.join(',');
        }
        if (matchAllTopics !== undefined)
            parameters.matchAllTopics = matchAllTopics.toString();
        if (fileTypes !== undefined) parameters.fileTypes = fileTypes.join(',');
        if (tag) parameters.tags = JSON.stringify(tag);
        if (take) parameters.take = take.toString();
        if (skip) parameters.skip = skip.toString();
        if (sort) parameters.sort = sort;
        if (desc !== undefined)
            parameters.sortDirection = desc ? 'DESC' : 'ASC';
        if (health) parameters.health = health;

        const queryParameters = new URLSearchParams(parameters).toString();
        const response: AxiosResponse<FilesDto> = await axios.get<FilesDto>(
            `/files/filtered?${queryParameters}`,
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching overview:', error);
        throw error; // Rethrow or handle as appropriate
    }
};

export const fetchFile = async (uuid: string): Promise<FileWithTopicDto> => {
    try {
        const response: AxiosResponse<FileWithTopicDto> =
            await axios.get<FileWithTopicDto>('/files/one', {
                params: { uuid },
            });
        return response.data;
    } catch (error) {
        console.error('Error fetching file:', error);
        throw error; // Rethrow or handle as appropriate
    }
};
export const downloadFile = async (
    uuid: string,
    expires: boolean,
    preview_only = false,
): Promise<string> => {
    const response = await axios.get('files/download', {
        params: {
            uuid,
            expires,
            preview_only,
        },
    });
    return response.data;
};

export const filesOfMission = async (
    missionUUID: string,
    take: number,
    skip: number,
    fileTypes?: FileType[],
    filename?: string,
    categories?: string[],
    sort = 'filename',
    desc = false,
    health?: HealthStatus,
): Promise<FilesDto> => {
    const tag: Record<string, unknown> = {};

    return fetchFilteredFiles(
        filename || '',
        undefined,
        missionUUID,
        undefined,
        undefined,
        undefined,
        categories,
        true,
        fileTypes,
        Object.keys(tag).length > 0 ? tag : undefined,
        take,
        skip,
        sort,
        desc,
        health,
    );
};

export const findOneByNameAndMission = async (
    filename: string,
    missionUUID: string,
): Promise<FileWithTopicDto> => {
    const response: AxiosResponse<FileWithTopicDto> =
        await axios.get<FileWithTopicDto>('files/oneByName', {
            params: {
                filename,
                uuid: missionUUID,
            },
        });
    return response.data;
};

export const getStorage = async (): Promise<StorageOverviewDto> => {
    const response: AxiosResponse<StorageOverviewDto> =
        await axios.get<StorageOverviewDto>('files/storage');
    return response.data;
};

export const getIsUploading = async (): Promise<boolean> => {
    const response: AxiosResponse<IsUploadingDto> =
        await axios.get('files/isUploading');
    return response.data.isUploading;
};

export const existsFile = async (
    uuid: string,
): Promise<FileExistsResponseDto | false> => {
    try {
        const response = await axios.get<FileExistsResponseDto>(
            '/files/exists',
            {
                params: { uuid },
            },
        );
        return response.data;
    } catch {
        return false;
    }
};

export const getFileEvents = async (
    fileUuid: string,
): Promise<FileEventsDto> => {
    const response = await axios.get<FileEventsDto>(
        `/files/${fileUuid}/events`,
    );
    return response.data;
};

export async function getFoxgloveLink(fileUuid: string): Promise<string> {
    const response = await axios.get<FoxgloveLinkResponseDto>(
        `files/${fileUuid}/foxglove-link`,
    );
    return response.data.url;
}
