import axios from 'src/api/axios';
import { User } from 'src/types/User';
import { Queue } from 'src/types/Queue';

export const currentQueue = async (startDate: Date) => {
    const params = {
        startDate: startDate.toISOString(),
    };
    const response = await axios.get('/queue/active', { params });
    const users: Record<string, User> = {};
    console.log('here');
    if (!response.data || response.data.length === 0) return [];
    console.log('here2', response.data);
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
