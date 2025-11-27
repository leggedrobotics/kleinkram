import { PermissionsDto } from '@api/types/permissions.dto';
import { CurrentAPIUserDto } from '@api/types/user/current-api-user.dto';
import { UsersDto } from '@api/types/user/users.dto';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

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

export const getPermissions = async (): Promise<PermissionsDto> => {
    const response: AxiosResponse<PermissionsDto> =
        await axios.get('/user/permissions');
    return response.data;
};
