import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import logger from '../logger';

export class AuthFlowException extends UnauthorizedException {
    constructor(message: string) {
        super(encodeURIComponent(message));
    }
}

@Catch(AuthFlowException)
export class AuthFlowExceptionRedirectFilter implements ExceptionFilter {
    public catch(exception: AuthFlowException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        logger.debug(`Redirecting to login with error: ${exception.message}`);
        const redirectUrl = `${process.env.FRONTEND_URL}/login?error_state=auth_flow_failed&error_msg=${exception.message}`;
        return response.redirect(302, redirectUrl);
    }
}
