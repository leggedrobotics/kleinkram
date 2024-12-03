import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { NextFunction, Request, Response } from 'express';
import { CookieNames } from '@common/frontend_shared/enum';

/**
 *
 * A nest middleware that resolves the user from the API key in the request.
 *
 */
@Injectable()
export class APIKeyResolverMiddleware implements NestMiddleware {
    constructor(private userService: UserService) {}

    async use(
        request: Request,
        _res: Response,
        next: NextFunction,
    ): Promise<void> {
        if (request.cookies !== undefined) {
            const key = request.cookies[CookieNames.CLI_KEY] as
                | string
                | undefined;

            if (key !== undefined) {
                request.user = await this.userService.findUserByAPIKey(key);
            }
        }

        // pass on to the next middleware function
        next();
    }
}
