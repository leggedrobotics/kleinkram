import { appVersion } from '@/app-version';
import { AuthFlowException } from '@/types/auth-flow-exception';
import env from '@kleinkram/backend-common/environment';
import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ConflictException,
    ExceptionFilter,
    ForbiddenException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import logger from '../../logger';

/** Fallback for 503s that don't carry an explicit retry hint. */
const DEFAULT_RETRY_AFTER_SECONDS = 15;

/**
 * A global error filter that catches all errors and logs them.
 *
 * This filter is used to catch all errors that are not caught by other filters,
 * formats them and sends them to the client with an associated status code.
 *
 */
@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public catch(exception: Error, host: ArgumentsHost): void {
        const response: Response = host.switchToHttp().getResponse();
        response.header('kleinkram-version', appVersion);
        response.header('Access-Control-Expose-Headers', 'kleinkram-version');

        //////////////////////////////
        // Errors that don't get logged
        //////////////////////////////
        if (exception.name === 'InvalidJwtTokenException') {
            response.status(401).json({
                statusCode: 401,
                message: 'Invalid JWT token. Are you logged in?',
            });
            return;
        }

        if (
            exception instanceof ForbiddenException ||
            exception instanceof UnauthorizedException
        ) {
            response.status(exception.getStatus()).json({
                statusCode: exception.getStatus(),
                message: exception.message,
            });
            return;
        }

        if (exception instanceof AuthFlowException) {
            // If the exception is an AuthFlowException, redirect to the frontend login page
            const authFlowException: AuthFlowException = exception;

            logger.debug(
                `Redirecting to login with error: ${authFlowException.message}`,
            );

            response
                .status(302)
                .redirect(
                    `${env.FRONTEND_URL}/login?error_state=auth_flow_failed&error_msg=${encodeURIComponent(
                        authFlowException.message,
                    )}`,
                );
            return;
        }

        if (
            exception.name === 'TokenError' ||
            exception.message === 'Failed to obtain access token'
        ) {
            // redirect to frontend login page
            response
                .status(302)
                .redirect(
                    `${env.FRONTEND_URL}/login?error_state=auth_flow_failed&error_msg=${encodeURIComponent(
                        'Failed to obtain access token. Please try again.',
                    )}`,
                );

            return;
        }

        if (exception instanceof BadRequestException) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resp: any = exception.getResponse();

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            if (typeof resp === 'object' && resp.hasOwnProperty('message')) {
                response.status(400).json({
                    statusCode: 400,
                    ...resp,

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    message: resp.message.toString(),
                });
                return;
            }
            response.status(400).json({
                statusCode: 400,
                message: exception.getResponse(),
            });
            return;
        }

        // Validation failures that list each invalid field (e.g. metadata
        // values): the client needs `errors` to mark the fields
        if (exception instanceof HttpException) {
            const resp: unknown = exception.getResponse();
            if (
                typeof resp === 'object' &&
                resp !== null &&
                'errors' in resp &&
                Array.isArray(resp.errors)
            ) {
                response.status(exception.getStatus()).json({
                    statusCode: exception.getStatus(),
                    ...resp,
                });
                return;
            }
        }

        //////////////////////////////
        // Errors that get logged
        //////////////////////////////

        const request: Request = host.switchToHttp().getRequest();

        if (exception instanceof ConflictException) {
            const resp: unknown = exception.getResponse();
            const rawUser = (
                request as unknown as { user?: Record<string, unknown> }
            ).user;
            const userLabel: string =
                (rawUser?.uuid as string | undefined) ??
                (rawUser?.email as string | undefined) ??
                'unauthenticated';
            const details =
                resp !== null && typeof resp === 'object' && 'errors' in resp
                    ? resp.errors
                    : exception.message;
            logger.warn(
                `ConflictException: user="${userLabel}" endpoint="${request.method} ${request.url}" reason=${JSON.stringify(details)}`,
            );
            response.status(409).json({
                statusCode: 409,
                ...(typeof resp === 'object' && resp !== null
                    ? resp
                    : { message: exception.message }),
            });
            return;
        }

        if (exception instanceof ServiceUnavailableException) {
            this.respondServiceUnavailable(exception, request, response);
            return;
        }

        // a unique name constraint, e.g. renaming a file onto a name its
        // mission already has: a conflict the user can fix, not a server error
        const duplicateMessage = getDuplicateMessage(exception);
        if (duplicateMessage !== undefined) {
            response.status(409).json({
                statusCode: 409,
                message: duplicateMessage,
            });
            logger.warn(
                `Duplicate name: endpoint="${request.method} ${request.url}" reason=${duplicateMessage}`,
            );
            return;
        }

        logger.error(
            `GlobalErrorFilter: ${exception.name} on kleinkram-version ${appVersion} on endpoint ${request.url} with method ${request.method}`,
        );
        logger.error(exception.message);
        logger.error(exception);
        logger.error(exception.stack);

        if (exception instanceof EntityNotFoundError) {
            response.status(400).json({
                statusCode: 400,
                message: 'Bad Request',
            });
            return;
        }

        if (exception instanceof HttpException) {
            response.status(exception.getStatus()).json({
                statusCode: exception.getStatus(),
                message: exception.message,
            });
            return;
        }

        if (exception.name === 'PayloadTooLargeError') {
            response.status(413).json({
                statusCode: 413,
                message: 'Payload too large',
            });
            return;
        }

        if (
            exception.name === 'QueryFailedError' &&
            exception.message.includes('invalid input syntax for type uuid')
        ) {
            response.status(400).json({
                statusCode: 400,
                message: 'Invalid UUID',
            });
            return;
        }

        const route: { url: string } = host.getArgByIndex(0);
        logger.error(`An error occurred on route ${route.url}!`);

        logger.error(`exception of type ${exception.name}`);
        logger.error(exception.message);
        logger.error(exception.stack);

        response.status(500).json({
            statusCode: 500,
            message: 'Internal server error',
        });
    }

    /**
     * A backing service being unavailable is an expected operational state,
     * not a bug, so it is logged as a warning rather than an error with a
     * stack trace. The response repeats whatever the exception carried (the
     * explanation the client needs) and adds `Retry-After` so clients know
     * this is worth retrying.
     */
    private respondServiceUnavailable(
        exception: ServiceUnavailableException,
        request: Request,
        response: Response,
    ): void {
        const resp: unknown = exception.getResponse();
        const retryAfterSeconds =
            typeof resp === 'object' &&
            resp !== null &&
            'retryAfterSeconds' in resp &&
            typeof resp.retryAfterSeconds === 'number'
                ? resp.retryAfterSeconds
                : DEFAULT_RETRY_AFTER_SECONDS;

        logger.warn(
            `ServiceUnavailable: endpoint="${request.method} ${request.url}" reason="${exception.message}"`,
        );

        response.header('Retry-After', retryAfterSeconds.toString());
        response.header(
            'Access-Control-Expose-Headers',
            'kleinkram-version, Retry-After',
        );
        response.status(503).json({
            statusCode: 503,
            ...(typeof resp === 'object' && resp !== null
                ? resp
                : { message: exception.message }),
        });
    }
}

/** Messages for the unique constraints a user can run into by naming things */
/* eslint-disable @typescript-eslint/naming-convention -- keys are Postgres constraint names */
const DUPLICATE_MESSAGES: Record<string, string> = {
    unique_file_name_per_mission:
        'A file with this name already exists in this mission.',
    unique_mission_name_per_project:
        'A mission with this name already exists in this project.',
    unique_project_name_active: 'A project with this name already exists.',
    unique_category_name_per_project:
        'A category with this name already exists in this project.',
    unique_access_group_name: 'An access group with this name already exists.',
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * The message for a violated unique constraint (Postgres code 23505) that
 * guards a user-chosen name, or undefined for any other error.
 */
const getDuplicateMessage = (exception: Error): string | undefined => {
    if (!(exception instanceof QueryFailedError)) return undefined;
    const driverError = exception.driverError as
        { code?: string; constraint?: string } | undefined;
    if (driverError?.code !== '23505') return undefined;
    return DUPLICATE_MESSAGES[driverError.constraint ?? ''];
};
