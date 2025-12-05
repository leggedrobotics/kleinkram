import { ApikeyEntity } from '@kleinkram/backend-common/entities/auth/apikey.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the user from the request.
 *
 * Throws an error if the user is not authenticated.
 *
 */
export const AddUser = createParamDecorator((_, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    if (request.user === undefined || request.user === null) {
        throw new Error('User not authenticated');
    }

    return request.user;
});

export interface AuthHeader {
    user: UserEntity;
    apiKey?: ApikeyEntity;
}
