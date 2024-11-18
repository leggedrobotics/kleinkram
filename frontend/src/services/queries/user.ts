import { User } from 'src/types/User';
import axios from 'src/api/axios';

export const searchUsers = async (search: string): Promise<User[]> => {
    if (!search) {
        return [];
    }
    const response = await axios.get('/user/search', { params: { search } });
    return response.data.map((user: any) => User.fromAPIResponse(user));
};

export const getMe = async (): Promise<User> => {
    const response = await axios.get('/user/me');
    return User.fromAPIResponse(await response.data);
};

export const getPermissions = async () => {
    const response = await axios.get('/user/permissions');
    return response.data;
};
