import winston, { format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import { Injectable, LoggerService } from '@nestjs/common';
import { TransformableInfo } from 'logform';
import { context, trace } from '@opentelemetry/api';

export const ACTION_CONTAINER_LABEL = 'action_container';
export const QUEUE_CONSUMER_LABEL = 'queue-consumer';

const ignoreContainerLogs = winston.format((info: any) => {
    if (info.labels?.job === ACTION_CONTAINER_LABEL) return false;
    return info;
});

const messageOnly = winston.format.printf(
    ({ level, message }: TransformableInfo): string => {
        return `[${level.toUpperCase()}]: ${message}`;
    },
);

const traceIdFormat = winston.format((info) => {
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
        info['trace_id'] = currentSpan.spanContext().traceId;
    }
    return info;
});

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        traceIdFormat(), // Add trace ID to the log format
        winston.format.json(), // Keep the JSON format
    ),
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
    log(message: never, ...optionalParameters: never[]): void {
        logger.info(message, ...optionalParameters);
    }

    fatal(message: never, ...optionalParameters: never[]): void {
        logger.error(message, ...optionalParameters);
    }

    error(message: never, ...optionalParameters: never[]): void {
        logger.error(message, ...optionalParameters);
    }

    warn(message: never, ...optionalParameters: never[]): void {
        logger.warn(message, ...optionalParameters);
    }

    debug?(message: never, ...optionalParameters: never[]): void {
        logger.debug(message, ...optionalParameters);
    }

    verbose?(message: never, ...optionalParameters: never[]): void {
        logger.verbose(message, ...optionalParameters);
    }
}

export default logger;
