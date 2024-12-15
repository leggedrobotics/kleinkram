import winston, { format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import { Injectable, LoggerService } from '@nestjs/common';

export const ACTION_CONTAINER_LABEL = 'action_container';
export const QUEUE_CONSUMER_LABEL = 'queue-consumer';

const ignoreContainerLogs = winston.format((info: any) => {
    if (info.labels?.job === ACTION_CONTAINER_LABEL) return false;
    return info;
});

const messageOnly = winston.format.printf(
    // @ts-ignore
    ({ level, message }: { level: string; message: string }) => {
        return `[${level.toUpperCase()}]: ${message}`;
    },
);

const logger = winston.createLogger({
    level: 'debug',
    format: format.json(),
    transports: [
        new transports.Console({
            format: format.combine(ignoreContainerLogs(), messageOnly),
        }),
        new LokiTransport({
            host: 'http://loki:3100',
            interval: 5,
            labels: {
                job: QUEUE_CONSUMER_LABEL,
                container_id: process.env['HOSTNAME'],
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
