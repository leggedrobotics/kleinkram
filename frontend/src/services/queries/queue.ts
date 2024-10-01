import axios from 'src/api/axios';
import { User } from 'src/types/User';
import { Queue } from 'src/types/Queue';
import { FileState } from 'src/enums/QUEUE_ENUM';

export const currentQueue = async (
    startDate: Date,
    stateFilter: FileState[],
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
                new Date(res.creator.deletedAt),
            );
            users[res.creator.uuid] = creator;
        }
        return new Queue(
            res.uuid,
            res.identifier,
            res.filename,
            res.state,
            res.location,
            res.mission,
            creator,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
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
            new Date(rawQueue.creator.deletedAt),
        );
        return new Queue(
            rawQueue.uuid,
            rawQueue.identifier,
            rawQueue.filename,
            rawQueue.state,
            rawQueue.location,
            rawQueue.mission,
            creator,
            new Date(rawQueue.createdAt),
            new Date(rawQueue.updatedAt),
            new Date(rawQueue.deletedAt),
        );
    });
};

export const bullQueue = async () => {
    const response = await axios.get('/queue/bullQueue');
    return response.data;
};
