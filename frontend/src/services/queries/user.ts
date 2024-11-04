import { User } from 'src/types/User';
import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';
import { AccessGroupUser } from 'src/types/AccessGroupUser';

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
        );
    });
};

export const getMe = async (): Promise<User> => {
    const response = await axios.get('/user/me');
    const user = response.data;
    const accessGroupUsers = user.accessGroupUsers.map((agu: any) => {
        const accessGroup = new AccessGroup(
            agu.accessGroup.uuid,
            agu.accessGroup.name,
            [],
            [],
            [],
            agu.accessGroup.personal,
            agu.accessGroup.inheriting,
            undefined,
            new Date(agu.accessGroup.createdAt),
            new Date(agu.accessGroup.updatedAt),
        );
        return new AccessGroupUser(
            agu.uuid,
            new Date(agu.createdAt),
            new Date(agu.updatedAt),
            null,
            accessGroup,
            new Date(agu.expirationDate),
        );
    });
    return new User(
        user.uuid,
        user.name,
        user.email,
        user.role,
        user.avatarUrl,
        [],
        accessGroupUsers,
        new Date(user.createdAt),
        new Date(user.updatedAt),
    );
};

export const getPermissions = async () => {
    const response = await axios.get('/user/permissions');
    return response.data;
};
