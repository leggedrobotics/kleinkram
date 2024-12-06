import axios from 'src/api/axios';
import { FileType } from '@common/enum';
import { StorageOverviewDto } from '@api/types/storage-overview.dto';
import { AxiosResponse } from 'axios';
import { FileWithTopicDto } from '@api/types/files/file.dto';
import { FilesDto } from '@api/types/files/files.dto';
import { IsUploadingDto } from '@api/types/files/is-uploading.dto';

export const fetchOverview = async (
    filename: string,
    projectUUID?: string,
    missionUUID?: string,
    startDate?: Date,
    endDate?: Date,
    topics?: string[],
    andOr?: boolean,
    fileTypes?: ('mcap' | 'bag')[],
    tag?: Record<string, any>,
    take?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
): Promise<FilesDto> => {
    try {
        const parameters: Record<string, string> = {};
        if (filename) parameters.fileName = filename;
        if (projectUUID) parameters.projectUUID = projectUUID;
        if (missionUUID) parameters.missionUUID = missionUUID;
        if (startDate) parameters.startDate = startDate.toISOString();
        if (endDate) parameters.endDate = endDate.toISOString();
        if (topics && topics.length > 0) parameters.topics = topics.join(',');
        if (andOr !== undefined) parameters.andOr = andOr.toString();
        if (fileTypes !== undefined) parameters.fileTypes = fileTypes.join(',');
        if (tag) parameters.tags = JSON.stringify(tag);
        if (take) parameters.take = take.toString();
        if (skip) parameters.skip = skip.toString();
        if (sort) parameters.sort = sort;
        if (desc !== undefined)
            parameters.sortDirection = desc ? 'DESC' : 'ASC';
        const queryParameters = new URLSearchParams(parameters).toString();
        const response: AxiosResponse<FilesDto> = await axios.get<FilesDto>(
            `/file/filtered?${queryParameters}`,
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
            await axios.get<FileWithTopicDto>('/file/one', {
                params: { uuid },
            });
        return response.data;
    } catch (error) {
        console.error('Error fetching file:', error);
        throw error; // Rethrow or handle as appropriate
    }
};
export const downloadFile = async (uuid: string, expires: boolean) => {
    const response = await axios.get('file/download', {
        params: {
            uuid,
            expires,
        },
    });
    return response.data;
};

export const filesOfMission = async (
    missionUUID: string,
    take: number,
    skip: number,
    fileType?: FileType,
    filename?: string,
    categories?: string[],
    sort?: string,
    desc?: boolean,
    health?: 'Healthy' | 'Unhealthy' | 'Uploading',
): Promise<FilesDto> => {
    const parameters: Record<string, string | number | boolean | string[]> = {
        uuid: missionUUID,
        take,
        skip,
    };
    if (fileType !== undefined && fileType !== FileType.ALL)
        parameters.fileType = fileType;
    if (filename) parameters.filename = filename;
    if (health) parameters.health = health;
    if (categories && categories.length > 0) parameters.categories = categories;
    parameters.sort = sort ? sort : 'filename';
    if (desc === undefined) {
        parameters.desc = 'ASC';
    } else {
        parameters.desc = desc ? 'DESC' : 'ASC';
    }
    const response: AxiosResponse<FilesDto> = await axios.get<FilesDto>(
        'file/ofMission',
        {
            params: parameters,
        },
    );
    return response.data;
};

export const findOneByNameAndMission = async (
    filename: string,
    missionUUID: string,
): Promise<FileWithTopicDto> => {
    const response: AxiosResponse<FileWithTopicDto> =
        await axios.get<FileWithTopicDto>('file/oneByName', {
            params: {
                filename,
                uuid: missionUUID,
            },
        });
    return response.data;
};

export const getStorage = async (): Promise<StorageOverviewDto> => {
    const response: AxiosResponse<StorageOverviewDto> =
        await axios.get<StorageOverviewDto>('file/storage');
    return response.data;
};

export const getIsUploading = async (): Promise<boolean> => {
    const response: AxiosResponse<IsUploadingDto> =
        await axios.get('file/isUploading');
    return response.data.isUploading;
};

export const existsFile = async (uuid: string) => {
    try {
        const response = await axios.get('/file/exists', {
            params: { uuid },
        });
        return response.data;
    } catch {
        return false;
    }
};
