import axios from 'src/api/axios';
import { QueueState } from '@common/enum';

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
): Promise<Queue[]> => {
    if (!filename || !missionUUID) return [];
    const params = {
        filename,
        uuid: missionUUID,
    };
    const response = await axios.get('/queue/forFile', { params });
    return response.data;
};

export const bullQueue = async () => {
    const response = await axios.get('/queue/bullQueue');
    return response.data;
};
