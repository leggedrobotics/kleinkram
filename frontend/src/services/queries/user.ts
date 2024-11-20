import { User } from 'src/types/User';
import axios from 'src/api/axios';
import { CurrentAPIUserDto } from '@api/types/User.dto';

export const searchUsers = async (search: string): Promise<User[]> => {
    if (!search) {
        return [];
    }
    const response = await axios.get('/user/search', { params: { search } });
    return response.data.map((user: any) => User.fromAPIResponse(user));
};

export const getMe = async (): Promise<CurrentAPIUserDto> => {
    const response = await axios.get<CurrentAPIUserDto>('/user/me');
    const user = response.data;
    if (!user) throw new Error('User not found');
    return user;
};

export const getPermissions = async () => {
    const response = await axios.get('/user/permissions');
    return response.data;
};
