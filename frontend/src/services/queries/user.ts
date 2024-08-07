import { User } from 'src/types/User';
import axios from 'src/api/axios';

export const searchUsers = async (search: string): Promise<User[]> => {
    const response = await axios.get('/user/search', { params: { search } });
    return response.data.map((user: any) => {
        return new User(
            user.uuid,
            user.name,
            user.email,
            user.role,
            user.avatarUrl,
            [],
            new Date(user.createdAt),
            new Date(user.updatedAt),
            new Date(user.deletedAt),
        );
    });
};

export const getMe = async (): Promise<User> => {
    console.log('getMe');
    const response = await axios.get('/user/me');
    const user = response.data;
    return new User(
        user.uuid,
        user.name,
        user.email,
        user.role,
        user.avatarUrl,
        [],
        new Date(user.createdAt),
        new Date(user.updatedAt),
        new Date(user.deletedAt),
    );
};
