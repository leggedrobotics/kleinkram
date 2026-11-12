// this input must be at the top of the file
import tracer, { shutdownTracing } from './tracing';

import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ActionManagerService } from './actions/services/action-manager.service';
import { AppModule } from './app.module';
import logger, { NestLoggerWrapper } from './logger';

let app: INestApplication | undefined;

// The worker exits right away on SIGTERM instead of closing the app: closing
// the queues would wait for running actions, which can take hours. The `finally`
// that revokes an action's API key therefore never runs, so revoke the keys
// of the running actions here before exiting.
process.once('SIGTERM', () => {
    void (async (): Promise<void> => {
        try {
            await app?.get(ActionManagerService).revokeLiveKeys();
        } catch (error: unknown) {
            logger.error(
                `Failed to revoke action API keys on shutdown: ${String(error)}`,
            );
        }
        await shutdownTracing();
        process.exit(0);
    })();
});

async function bootstrap(): Promise<void> {
    tracer.start();
    const instance = await NestFactory.create(AppModule, {
        logger: new NestLoggerWrapper(),
    });
    app = instance;
    await instance.listen(3000);
    logger.info('Application started');

    if (module.hot) {
        module.hot.accept();
        module.hot.dispose(() => instance.close());
    }
}

declare const module: {
    hot?: {
        accept: () => void;
        dispose: (callback: () => Promise<void>) => void;
    };
};

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap().catch((error: unknown) => {
    logger.error('Failed to start application');
    logger.error(error);
});
