import environment from '@common/environment';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AuthFlowExceptionRedirectFilter } from './routing/filters/auth-flow-exception';
import tracer from './tracing';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'node:fs';
import logger, { NestLoggerWrapper } from './logger';
import { GlobalErrorFilter } from './routing/filters/global-error-filter';
import { GlobalResponseValidationInterceptor } from './routing/interceptors/output-validation';
import { AddVersionInterceptor } from './routing/interceptors/version-injector';

function saveEndpointsAsJson(app: INestApplication, filename: string): void {
    const server = app.getHttpServer();
    const endpoints = server._events.request._router.stack
        .filter((r: any) => r.route)
        .map((r: any) => ({
            url: r.route.path,
            method: r.route.stack[0].method,
        }));

    fs.writeFileSync(filename, JSON.stringify(endpoints, null, 2));
}

async function bootstrap(): Promise<void> {
    tracer.start();

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: new NestLoggerWrapper(),
    });

    app.useGlobalInterceptors(new AddVersionInterceptor());
    app.use(cookieParser());
    app.useGlobalFilters(new AuthFlowExceptionRedirectFilter());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            forbidUnknownValues: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );
    app.enableCors({
        origin: [environment.FRONTEND_URL, environment.DOCS_URL],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        credentials: true,
        optionsSuccessStatus: 204,
    });

    app.useGlobalFilters(new GlobalErrorFilter());

    /**
     * replaces query string parser with qs
     */
    app.set('query parser', 'extended');

    /**
     * Applies the global response validation interceptor to the application.
     * This is only enabled in the development environment.
     */
    if (environment.DEV) {
        logger.debug(
            `Enabling global response validation interceptor (dev-mode = ${environment.DEV.toString()})`,
        );
        logger.warn(
            'Global response validation interceptor is enabled. This should only be ' +
                'enabled in development mode. This may slow down the application.',
        );
        app.useGlobalInterceptors(
            new GlobalResponseValidationInterceptor(new Reflector()),
        );
    }

    const config = new DocumentBuilder()
        .setTitle('API Documentation')
        .setDescription('API description')
        .setVersion('1.0')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, {
        jsonDocumentUrl: 'swagger/json',
        yamlDocumentUrl: 'swagger/yaml',
        swaggerUiEnabled: environment.DEV,
    });

    await app.listen(3000);
    logger.debug('Listening on port 3000');

    logger.debug('Save endpoints as JSON');
    saveEndpointsAsJson(app, '.endpoints/__generated__endpoints.json');
    logger.debug('Endpoints saved');
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap().catch((error: unknown) => {
    logger.error('Failed to start application');
    logger.error(error);
});
