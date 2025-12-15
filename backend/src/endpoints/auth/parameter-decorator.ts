import { ApiKeyEntity } from '@kleinkram/backend-common';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the user from the request.
 *
 * Throws an error if the user is not authenticated.
 *
 */
export const AddUser = createParamDecorator((_, context: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (request.user === undefined || request.user === null) {
        throw new Error('User not authenticated');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return request.user;
});

export interface AuthHeader {
    user: UserEntity;
    apiKey?: ApiKeyEntity;
}
