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
    log(message: any, ...optionalParams: any[]) {
        logger.info(message, ...optionalParams);
    }

    fatal(message: any, ...optionalParams: any[]) {
        logger.error(message, ...optionalParams);
    }

    error(message: any, ...optionalParams: any[]) {
        logger.error(message, ...optionalParams);
    }

    warn(message: any, ...optionalParams: any[]) {
        logger.warn(message, ...optionalParams);
    }

    debug?(message: any, ...optionalParams: any[]) {
        logger.debug(message, ...optionalParams);
    }

    verbose?(message: any, ...optionalParams: any[]) {
        logger.verbose(message, ...optionalParams);
    }
}

export default logger;
