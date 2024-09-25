import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserService } from './user/user.service';
import { NextFunction, Request, Response } from 'express';
import { CookieNames } from '@common/enum';

@Injectable()
export class UserResolverMiddleware implements NestMiddleware {
    constructor(private userService: UserService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        if (req && req.cookies) {
            const key = req.cookies[CookieNames.CLI_KEY];
            if (key) {
                req.user = await this.userService.findOneByApiKey(key);
            }
        }
        next();
    }
}
