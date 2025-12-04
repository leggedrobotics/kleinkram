import type { UserDto } from '@kleinkram/api-dto';
import type UserEntity from '@kleinkram/backend-common/entities/user/user.entity';

export const userEntityToDto = (
    user: UserEntity,
    includeEmail = false,
): UserDto => {
    return {
        uuid: user.uuid,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        email: includeEmail && user.email ? user.email : null,
    };
};
