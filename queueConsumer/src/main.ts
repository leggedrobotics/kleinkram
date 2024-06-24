// this input must be at the top of the file
import tracer from './tracing';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import logger from './logger';

async function bootstrap() {
    tracer.start();
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
    logger.info('Application started');
}

bootstrap().catch((err) => {
    logger.error('Failed to start application');
    logger.error(err);
});
