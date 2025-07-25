import { CookieNames } from '@common/frontend_shared/enum';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import logger from '../../logger';
import { ActionService } from '../../services/action.service';

/**
 *
 * Logger middleware for audit logging.
 * Logs every authenticated request made to the application.*
 *
 */
@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
    constructor(private actionService: ActionService) {}

    async use(
        request: Request,
        _: Response,
        next: NextFunction,
    ): Promise<void> {
        if (!request.cookies) {
            next(); // pass on to the next middleware function
            return;
        }

        const key = request.cookies[CookieNames.CLI_KEY] as string | undefined;
        if (key === undefined) {
            next(); // pass on to the next middleware function
            return;
        }

        const auditLog = {
            method: request.method,
            url: request.originalUrl,
        };

        logger.debug(
            `AuditLoggerMiddleware: ${JSON.stringify(auditLog, undefined, 2)}`,
        );

        await this.actionService.writeAuditLog(key, auditLog).then(() => {
            logger.debug('Audit log written');
        });

        // pass on to the next middleware function
        next();
    }
}
