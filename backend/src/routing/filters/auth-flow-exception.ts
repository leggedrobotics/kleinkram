import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { AuthFlowException } from 'src/types/auth-flow-exception';
import logger from '../../logger';

@Catch(AuthFlowException)
export class AuthFlowExceptionRedirectFilter implements ExceptionFilter {
    frontendUrl: string;

    constructor() {
        logger.debug('AuthFlowExceptionRedirectFilter created');

        const frontendUrl = process.env['FRONTEND_URL'];
        if (frontendUrl === undefined) {
            throw new Error('FRONTEND_URL env var not set');
        }

        this.frontendUrl = frontendUrl;
    }

    public catch(exception: AuthFlowException, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        logger.debug(`Redirecting to login with error: ${exception.message}`);
        const redirectUrl = `${this.frontendUrl}/login?error_state=auth_flow_failed&error_msg=${exception.message}`;
        response.redirect(302, redirectUrl);
    }
}
