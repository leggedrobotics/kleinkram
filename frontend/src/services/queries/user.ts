import type { PermissionsDto } from '@kleinkram/api-dto/types/permissions.dto';
import type { ApiKeyMetadataDto } from '@kleinkram/api-dto/types/user/api-key-metadata.dto';
import type { CurrentAPIUserDto } from '@kleinkram/api-dto/types/user/current-api-user.dto';
import type { UsersDto } from '@kleinkram/api-dto/types/user/users.dto';
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!user) throw new Error('User not found');
    return user;
};

export const getPermissions = async (): Promise<PermissionsDto> => {
    const response: AxiosResponse<PermissionsDto> =
        await axios.get('/user/permissions');
    return response.data;
};

export const getMyApiKeys = async (): Promise<ApiKeyMetadataDto[]> => {
    const response = await axios.get<ApiKeyMetadataDto[]>('/user/api-keys');
    return response.data;
};
