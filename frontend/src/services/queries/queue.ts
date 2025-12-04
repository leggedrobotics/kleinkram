import { QueueState } from '@kleinkram/shared';
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
