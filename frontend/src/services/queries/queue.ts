import axios from 'src/api/axios';
import { QueueState } from '@common/enum';
import { FileQueueEntriesDto } from '@api/types/FileQueueEntry.dto';
import { AxiosResponse } from 'axios';

export const currentQueue = async (
    startDate: Date,
    stateFilter: QueueState[],
) => {
    const params = {
        startDate: startDate.toISOString(),
        stateFilter: stateFilter.length > 0 ? stateFilter.join(',') : undefined,
    };
    const response = await axios.get('/queue/active', { params });
    return response.data;
};

export const getQueueForFile = async (
    filename: string,
    missionUUID: string,
): Promise<FileQueueEntriesDto> => {
    const params = {
        filename,
        uuid: missionUUID,
    };
    const response: AxiosResponse<FileQueueEntriesDto> =
        await axios.get<FileQueueEntriesDto>('/queue/forFile', { params });
    return response.data;
};

export const bullQueue = async () => {
    const response = await axios.get('/queue/bullQueue');
    return response.data;
};
