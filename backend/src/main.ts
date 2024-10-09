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
    PipeTransform,
    ValidationPipe,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import logger, { NestLoggerWrapper } from './logger';
import { AddVersionInterceptor } from './versionInjector';
import * as fs from 'node:fs';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { InvalidJwtTokenException } from './auth/jwt.strategy';

const packageJson = JSON.parse(
    fs.readFileSync('/usr/src/app/backend/package.json', 'utf8'),
);
export const appVersion = packageJson.version;

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public catch(exception: Error, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse();
        response.header('kleinkram-version', appVersion);
        response.header('Access-Control-Expose-Headers', 'kleinkram-version');

        if (exception instanceof BadRequestException) {
            response.status(400).json({
                statusCode: 400,
                message: exception.getResponse()['message'][0],
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

        if (exception.name === 'InvalidJwtTokenException') {
            response.status(401).json({
                statusCode: 401,
                message: 'Invalid JWT token. Are you logged in?',
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

        logger.error(
            `An error occurred on route ${host.getArgByIndex(0).url}!`,
        );

        logger.error(`exception of type ${exception.name}`);
        logger.error(exception.message);
        logger.error(exception.stack);

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

class DelayPipe implements PipeTransform {
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

    app.useGlobalInterceptors(new AddVersionInterceptor());
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

    app.useGlobalFilters(new GlobalErrorFilter());
    app.useGlobalPipes(new DelayPipe(0));
    const config = new DocumentBuilder()
        .setTitle('API Documentation')
        .setDescription('API description')
        .setVersion('1.0')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    // // Save the Swagger JSON
    try {
        const swaggerOutputPath = './docs/swagger-spec.json';
        fs.writeFileSync(swaggerOutputPath, JSON.stringify(document));
    } catch (e) {
        console.log(e);
    }

    console.log('Listening on port 3000');
    await app.listen(3000);
    console.log('Save endpoints as JSON');
    save_endpoints_as_json(app, '.endpoints/__generated__endpoints.json');
    console.log('Endpoints saved');
}

bootstrap().catch((err) => {
    logger.error('Failed to start application');
    logger.error(err);
});
