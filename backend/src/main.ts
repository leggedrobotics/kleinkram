import tracer from './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import env from './env';
import { AuthFlowExceptionRedirectFilter } from './auth/authFlowException';

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import logger from './logger';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public catch(exception: Error, host: ArgumentsHost) {
        logger.error(`An error occurred on route ${host.getArgByIndex(0).url}!`);
        logger.error(exception.message);
        logger.error(exception.stack);

        const response = host.switchToHttp().getResponse();
        response.status(500).json({
            statusCode: 500,
            message: 'Internal server error',
        });

    }
}

async function bootstrap() {
    tracer.start();

    const app = await NestFactory.create(AppModule);
    app.use(cookieParser());
    app.useGlobalFilters(new AuthFlowExceptionRedirectFilter());
    app.enableCors({
        origin: env.FRONTEND_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        credentials: true,
        optionsSuccessStatus: 204,
    });
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.listen(3000);
}

bootstrap().catch((err) => {
    logger.error('Failed to start application');
    logger.error(err);
});
