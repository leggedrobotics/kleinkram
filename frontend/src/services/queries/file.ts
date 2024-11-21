import axios from 'src/api/axios';
import { FileType } from '@common/enum';
import { StorageOverviewDto } from '@api/types/StorageOverview.dto';
import { AxiosResponse } from 'axios';

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
): Promise<[FileEntity[], number]> => {
    try {
        const params: Record<string, string> = {};
        if (filename) params.fileName = filename;
        if (projectUUID) params.projectUUID = projectUUID;
        if (missionUUID) params.missionUUID = missionUUID;
        if (startDate) params.startDate = startDate.toISOString();
        if (endDate) params.endDate = endDate.toISOString();
        if (topics && topics.length > 0) params.topics = topics.join(',');
        if (andOr !== undefined) params.andOr = andOr.toString();
        if (fileTypes !== undefined) params.fileTypes = fileTypes.join(',');
        if (tag) params.tags = JSON.stringify(tag);
        if (take) params.take = take.toString();
        if (skip) params.skip = skip.toString();
        if (sort) params.sort = sort;
        if (desc !== undefined) params.sortDirection = desc ? 'DESC' : 'ASC';
        const queryParams = new URLSearchParams(params).toString();
        const response = await axios.get(`/file/filtered?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching overview:', error);
        throw error; // Rethrow or handle as appropriate
    }
};

export const fetchFile = async (uuid: string): Promise<FileEntity> => {
    try {
        const response = await axios.get('/file/one', { params: { uuid } });
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
): Promise<[FileEntity[], number]> => {
    const params: Record<string, string | number | boolean | string[]> = {
        uuid: missionUUID,
        take,
        skip,
    };
    if (fileType != null && fileType !== FileType.ALL)
        params.fileType = fileType;
    if (filename) params.filename = filename;
    if (health) params.health = health;
    if (categories && categories.length > 0) params.categories = categories;
    if (sort) params.sort = sort;
    else params.sort = 'filename';
    if (desc !== undefined) params.desc = desc ? 'DESC' : 'ASC';
    else params.desc = 'ASC';
    const response = await axios.get('file/ofMission', {
        params,
    });
    return response.data;
};

export const findOneByNameAndMission = async (
    filename: string,
    missionUUID: string,
): Promise<FileEntity> => {
    const response = await axios.get('file/oneByName', {
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
    const response = await axios.get('file/isUploading');
    return response.data as boolean;
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
