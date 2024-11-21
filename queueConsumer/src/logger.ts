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
