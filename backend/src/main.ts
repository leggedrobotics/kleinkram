import tracer from './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import env from '../../common/env';
import { AuthFlowExceptionRedirectFilter } from './auth/authFlowException';

import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ExceptionFilter,
    INestApplication,
    ValidationPipe,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import logger, { NestLoggerWrapper } from './logger';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public catch(exception: Error, host: ArgumentsHost) {
        if (exception instanceof BadRequestException) {
            const response = host.switchToHttp().getResponse();
            response.status(400).json({
                statusCode: 400,
                message: exception.getResponse()['message'][0],
            });
            return;
        }

        if (exception instanceof HttpException) {
            const response = host.switchToHttp().getResponse();
            response.status(exception.getStatus()).json({
                statusCode: exception.getStatus(),
                message: exception.message,
            });
            return;
        }

        logger.error(
            `An error occurred on route ${host.getArgByIndex(0).url}!`,
        );
        logger.error(exception.message);
        logger.error(exception.stack);

        const response = host.switchToHttp().getResponse();
        response.status(500).json({
            statusCode: 500,
            message: 'Internal server error',
        });
    }
}

function save_endpoints_as_json(app: INestApplication, filename: string) {
    const server = app.getHttpServer();
    const endpoints = server._events.request._router.stack
        .filter((r: any) => r.route)
        .map((r: any) => ({
            url: r.route.path,
            method: r.route.stack[0].method,
        }));

    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(endpoints, null, 2));
}

class DelayPipe {
    constructor(private delay: number) {}

    async transform(value: any) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
        return value;
    }
}

async function bootstrap() {
    tracer.start();

    const app = await NestFactory.create(AppModule, {
        logger: new NestLoggerWrapper(),
    });
    app.use(cookieParser());
    app.useGlobalFilters(new AuthFlowExceptionRedirectFilter());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );
    app.enableCors({
        origin: env.FRONTEND_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        credentials: true,
        optionsSuccessStatus: 204,
    });

    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalFilters(new GlobalErrorFilter());
    app.useGlobalPipes(new DelayPipe(0));

    await app.listen(3000);

    save_endpoints_as_json(app, '__generated__endpoints.json');
}

bootstrap().catch((err) => {
    logger.error('Failed to start application');
    logger.error(err);
});
