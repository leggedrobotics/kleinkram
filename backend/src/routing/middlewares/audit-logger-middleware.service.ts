import { CookieNames } from '@kleinkram/shared';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import logger from '../../logger';
import { ActionService } from '../../services/action.service';

/**
 *
 * Logger middleware for audit logging.
 * Logs every authenticated request made to the application.
 *
 */
@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
    constructor(private actionService: ActionService) {}

    use(request: Request, _: Response, next: NextFunction): void {
        if (!request.cookies) {
            next(); // pass on to the next middleware function
            return;
        }

        const key = request.cookies[CookieNames.CLI_KEY] as string | undefined;
        if (key === undefined) {
            next(); // pass on to the next middleware function
            return;
        }

        // Pass control to the next function immediately.
        // The request will continue to the controller and return a response.
        next();

        const auditLog = {
            method: request.method,
            url: request.originalUrl,
            message: '',
        };

        logger.debug(
            `AuditLoggerMiddleware: ${JSON.stringify(auditLog, undefined, 2)}`,
        );

        this.actionService
            .writeAuditLog(key, auditLog)
            .then(() => {
                logger.debug(`Audit log written for ${auditLog.url}`);
            })
            .catch((error: unknown) => {
                logger.error('Failed to write audit log', error);
            });
    }
}
