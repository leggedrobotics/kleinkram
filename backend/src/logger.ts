import winston, { format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import { Injectable, LoggerService } from '@nestjs/common';

const messageOnly = winston.format.printf(
    // @ts-ignore
    ({ level, message }: { level: string; message: string }) => {
        return `[${level.toUpperCase()}]: ${message}`;
    },
);

const logger = winston.createLogger({
    level: 'debug',
    levels: winston.config.npm.levels,
    format: format.json(),
    transports: [
        new transports.Console({ format: messageOnly }),
        new LokiTransport({
            host: 'http://loki:3100',
            interval: 5,
            labels: {
                job: 'backend',
            },
            json: true,
            format: winston.format.json(),
            replaceTimestamp: true,
        }),
    ],
});

@Injectable()
export class NestLoggerWrapper implements LoggerService {
    log(message: any, ...optionalParameters: any[]) {
        logger.info(message, ...optionalParameters);
    }

    fatal(message: any, ...optionalParameters: any[]) {
        logger.error(message, ...optionalParameters);
    }

    error(message: any, ...optionalParameters: any[]) {
        logger.error(message, ...optionalParameters);
    }

    warn(message: any, ...optionalParameters: any[]) {
        logger.warn(message, ...optionalParameters);
    }

    debug?(message: any, ...optionalParameters: any[]) {
        logger.debug(message, ...optionalParameters);
    }

    verbose?(message: any, ...optionalParameters: any[]) {
        logger.verbose(message, ...optionalParameters);
    }
}

export default logger;
