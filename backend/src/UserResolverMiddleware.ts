import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserService } from './user/user.service';
import { NextFunction, Request, Response } from 'express';
import { CookieNames } from '@common/frontend_shared/enum';

@Injectable()
export class UserResolverMiddleware implements NestMiddleware {
    constructor(private userService: UserService) {}

    async use(
        request: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        if (request.cookies) {
            const key = request.cookies[CookieNames.CLI_KEY] as string;
            if (key !== '') {
                request.user = await this.userService.findOneByApiKey(key);
            }
        }
        next();
    }
}
