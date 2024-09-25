import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';

export const addUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user || null;
    },
);

export class AuthRes {
    user: User;
    apikey: Apikey;
}
