import { CookieNames } from '@common/frontend_shared/enum';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { UserService } from '../../services/user.service';

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
        _: Response,
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
