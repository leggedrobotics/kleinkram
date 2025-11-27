import type { UserDto } from '@common/api/types/user/user.dto';
import type UserEntity from '@common/entities/user/user.entity';

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
