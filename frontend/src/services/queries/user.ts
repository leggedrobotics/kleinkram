import axios from 'src/api/axios';
import { CurrentAPIUserDto, UsersDto } from '@api/types/User.dto';
import { AxiosResponse } from 'axios';

export const searchUsers = async (search: string): Promise<UsersDto> => {
    if (search === '') {
        return {
            users: [],
            count: 0,
        };
    }
    const response: AxiosResponse<UsersDto> = await axios.get<UsersDto>(
        '/user/search',
        { params: { search } },
    );
    return response.data;
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
