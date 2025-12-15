import { UserService } from '@/services/user.service';
import { CookieNames } from '@kleinkram/shared';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (request.cookies !== undefined) {
            const key = request.cookies[CookieNames.CLI_KEY] as
                | string
                | undefined;

            if (key !== undefined) {
                request.user = await this.userService.findUserByAPIKey(key);
            }
        }

        if (!request.user) {
            const headerKey = request.headers['x-api-key'] as
                | string
                | undefined;
            if (headerKey) {
                request.user =
                    await this.userService.findUserByAPIKey(headerKey);
            }
        }

        // pass on to the next middleware function
        next();
    }
}
