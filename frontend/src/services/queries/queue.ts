import { FileQueueEntriesDto } from '@api/types/file/file-queue-entry.dto';
import { QueueState } from '@common/enum';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const currentQueue = async (
    startDate: Date,
    stateFilter: QueueState[],
) => {
    const parameters = {
        startDate: startDate.toISOString(),
        stateFilter: stateFilter.length > 0 ? stateFilter.join(',') : undefined,
    };
    const response = await axios.get('/queue/active', { params: parameters });
    return response.data;
};

export const getQueueForFile = async (
    filename: string,
    missionUUID: string,
): Promise<FileQueueEntriesDto> => {
    const parameters = {
        filename,
        uuid: missionUUID,
    };
    const response: AxiosResponse<FileQueueEntriesDto> =
        await axios.get<FileQueueEntriesDto>('/queue/forFile', {
            params: parameters,
        });
    return response.data;
};

export const bullQueue = async () => {
    const response = await axios.get('/queue/bullQueue');
    return response.data;
};
