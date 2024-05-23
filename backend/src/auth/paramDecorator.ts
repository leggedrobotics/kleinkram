import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const addJWTUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);

export class JWTUser {
  userId: string;
  username: string;
}
