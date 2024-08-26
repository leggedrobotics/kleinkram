import { User } from 'src/types/User';
import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';

export const searchUsers = async (search: string): Promise<User[]> => {
    if (!search) {
        return [];
    }
    const response = await axios.get('/user/search', { params: { search } });
    return response.data.map((user: any) => {
        return new User(
            user.uuid,
            user.name,
            user.email,
            user.role,
            user.avatarUrl,
            [],
            [],
            new Date(user.createdAt),
            new Date(user.updatedAt),
            new Date(user.deletedAt),
        );
    });
};

export const getMe = async (): Promise<User> => {
    const response = await axios.get('/user/me');
    const user = response.data;
    const accessGroups = user.accessGroups.map((group: any) => {
        return new AccessGroup(
            group.uuid,
            group.name,
            [],
            [],
            [],
            group.personal,
            group.inheriting,
            undefined,
            new Date(group.createdAt),
            new Date(group.updatedAt),
            new Date(group.deletedAt),
        );
    });
    return new User(
        user.uuid,
        user.name,
        user.email,
        user.role,
        user.avatarUrl,
        [],
        accessGroups,
        new Date(user.createdAt),
        new Date(user.updatedAt),
        new Date(user.deletedAt),
    );
};
