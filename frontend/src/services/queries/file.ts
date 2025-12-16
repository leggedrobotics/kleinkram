import type { FileExistsResponseDto } from '@kleinkram/api-dto/types/file/access.dto';
import type { DownloadResponseDto } from '@kleinkram/api-dto/types/file/download-response.dto';
import type { FileEventsDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import type { FoxgloveLinkResponseDto } from '@kleinkram/api-dto/types/file/foxglove-link-response.dto';
import type { IsUploadingDto } from '@kleinkram/api-dto/types/file/is-uploading.dto';
import type { StorageOverviewDto } from '@kleinkram/api-dto/types/storage-overview.dto';
import { FileType, HealthStatus } from '@kleinkram/shared';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export interface FilteredFilesConfig {
    filename?: string | undefined;
    projectUUID?: string | undefined;
    missionUUID?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    topics?: string[] | undefined;
    messageDatatypes?: string[] | undefined;
    categories?: string[] | undefined;
    matchAllTopics?: boolean | undefined;
    fileTypes?: FileType[] | undefined;
    tag?: Record<string, unknown> | undefined;
    take?: number | undefined;
    skip?: number | undefined;
    sort?: string | undefined;
    desc?: boolean | undefined;
    health?: HealthStatus | undefined;
}

export const fetchFilteredFiles = async (
    config: FilteredFilesConfig,
): Promise<FilesDto> => {
    const {
        filename,
        projectUUID,
        missionUUID,
        startDate,
        endDate,
        topics,
        messageDatatypes,
        categories,
        matchAllTopics,
        fileTypes,
        tag,
        take,
        skip,
        sort,
        desc,
        health,
    } = config;
    try {
        const parameters: Record<string, string> = {};
        if (filename) parameters.fileName = filename;
        if (projectUUID) parameters.projectUUID = projectUUID;
        if (missionUUID) parameters.missionUUID = missionUUID;
        if (startDate) parameters.startDate = startDate.toISOString();
        if (endDate) parameters.endDate = endDate.toISOString();
        if (topics && topics.length > 0) parameters.topics = topics.join(',');
        if (messageDatatypes && messageDatatypes.length > 0)
            parameters.messageDatatypes = messageDatatypes.join(',');
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

    // eslint-disable-next-line @typescript-eslint/naming-convention
    preview_only = false,
): Promise<string> => {
    const response = await axios.get<DownloadResponseDto>('files/download', {
        params: {
            uuid,

            expires,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            preview_only,
        },
    });
    return response.data.url;
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

    return fetchFilteredFiles({
        filename: filename ?? '',
        missionUUID,
        categories,
        matchAllTopics: true,
        fileTypes,
        tag: Object.keys(tag).length > 0 ? tag : undefined,
        take,
        skip,
        sort,
        desc,
        health,
    });
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
