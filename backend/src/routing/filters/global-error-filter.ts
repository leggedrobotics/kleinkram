import env from '@common/environment';
import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ExceptionFilter,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Response } from 'express';
import { appVersion } from 'src/app-version';
import { AuthFlowException } from 'src/types/auth-flow-exception';
import { EntityNotFoundError } from 'typeorm';
import logger from '../../logger';

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
            const resp: any = exception.getResponse();

            if (typeof resp === 'object' && resp.hasOwnProperty('message')) {
                response.status(400).json({
                    statusCode: 400,
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

        //////////////////////////////
        // Errors that get logged
        //////////////////////////////

        const request: Request = host.switchToHttp().getRequest();
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
        logger.error(`An error occurred on route ${route.url.toString()}!`);

        logger.error(`exception of type ${exception.name}`);
        logger.error(exception.message);
        logger.error(exception.stack);

        response.status(500).json({
            statusCode: 500,
            message: 'Internal server error',
        });
    }
}
