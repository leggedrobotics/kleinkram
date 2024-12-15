import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';

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
    user: User;
    apikey?: Apikey;
}
