import axios from 'src/api/axios';
import { User } from 'src/types/User';
import { Queue } from 'src/types/Queue';
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
    const users: Record<string, User> = {};
    if (!response.data || response.data.length === 0) return [];
    return response.data.map((res: any) => {
        let creator: User | undefined = users[res.creator.uuid];
        if (!creator) {
            creator = new User(
                res.creator.uuid,
                res.creator.name,
                res.creator.email,
                res.creator.role,
                res.creator.avatarUrl,
                [],
                new Date(res.creator.createdAt),
                new Date(res.creator.updatedAt),
            );
            users[res.creator.uuid] = creator;
        }
        return new Queue(
            res.uuid,
            res.identifier,
            res.display_name,
            res.state,
            res.location,
            res.mission,
            creator,
            new Date(res.createdAt),
            new Date(res.updatedAt),
        );
    });
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
    const res = response.data;
    return res.map((rawQueue: any) => {
        const creator = new User(
            rawQueue.creator.uuid,
            rawQueue.creator.name,
            rawQueue.creator.email,
            rawQueue.creator.role,
            rawQueue.creator.avatarUrl,
            [],
            new Date(rawQueue.creator.createdAt),
            new Date(rawQueue.creator.updatedAt),
        );
        return new Queue(
            rawQueue.uuid,
            rawQueue.identifier,
            rawQueue.display_name,
            rawQueue.state,
            rawQueue.location,
            rawQueue.mission,
            creator,
            new Date(rawQueue.createdAt),
            new Date(rawQueue.updatedAt),
        );
    });
};

export const bullQueue = async () => {
    const response = await axios.get('/queue/bullQueue');
    return response.data;
};
