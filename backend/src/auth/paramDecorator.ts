import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const addUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user.user || null;
    },
);

export class JWTUser {
    uuid: string;
}
