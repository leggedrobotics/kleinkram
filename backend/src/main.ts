import tracer from './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import logger from './logger';
import cookieParser from 'cookie-parser';
import env from './env';

async function bootstrap() {
    tracer.start();

    const app = await NestFactory.create(AppModule);
    app.use(cookieParser());
    app.enableCors({
        origin: env.FRONTEND_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        credentials: true,
        optionsSuccessStatus: 204,
    });
    await app.listen(3000);
}

bootstrap().catch((err) => {
    logger.error('Failed to start application');
    logger.error(err);
});
