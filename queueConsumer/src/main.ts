// this input must be at the top of the file
import tracer from './tracing';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import logger, { NestLoggerWrapper } from './logger';

async function bootstrap(): Promise<void> {
    tracer.start();
    const app = await NestFactory.create(AppModule, {
        logger: new NestLoggerWrapper(),
    });
    await app.listen(3000);
    logger.info('Application started');
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap().catch((error: unknown) => {
    logger.error('Failed to start application');
    logger.error(error);
});
