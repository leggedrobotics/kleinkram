import { Injectable, LoggerService } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { TransformableInfo } from 'logform';
import winston, { transports } from 'winston';
import LokiTransport from 'winston-loki';
import { appVersion } from './app-version';

const messageOnly = winston.format.printf(
    ({ level, message }: TransformableInfo): string => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `[${level.toUpperCase()}]: ${message}`;
    },
);

const traceIdFormat = winston.format((info) => {
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
        info.trace_id = currentSpan.spanContext().traceId;
    }
    return info;
});

const lokiLabelFormat = winston.format((info) => {
    // These keys will be promoted to Loki labels for better indexing/filtering
    const keysToPromote = [
        'project_id',
        'mission_id',
        'file_id',
        'user_id',
        'method',
        'target',
        'http_endpoint',
        'normalized_target',
        'status_code',
        'guard_enriched',
        'duration_ms',
    ];

    const labels: Record<string, string> = {};
    for (const key of keysToPromote) {
        if (info[key] !== undefined && info[key] !== null) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            labels[key] = String(info[key]);
        }
    }

    if (Object.keys(labels).length > 0) {
        // winston-loki picks up labels from the 'labels' property of the info object
        info.labels = Object.assign(info.labels ?? {}, labels);
    }
    return info;
});

const logger = winston.createLogger({
    level: 'debug',
    levels: winston.config.npm.levels,
    format: winston.format.combine(
        traceIdFormat(), // Add trace ID to the log format
        lokiLabelFormat(), // Promote specific fields to Loki labels
        winston.format.json(), // Keep the JSON format
    ),
    transports: [
        new transports.Console({ format: messageOnly }),
        new LokiTransport({
            host: 'http://loki:3100',
            interval: 5,
            labels: {
                job: 'backend',

                // eslint-disable-next-line @typescript-eslint/naming-convention
                container_id: process.env.HOSTNAME,
                version: appVersion,
            },
            json: true,
            format: winston.format.json(),
            replaceTimestamp: true,
        }),
    ],
});

@Injectable()
export class NestLoggerWrapper implements LoggerService {
    // Messages to filter out from console logs (reduce initialization spam)
    private shouldFilterMessage(message: string): boolean {
        const filters = [
            'dependencies initialized',
            'Mapped {/', // Route mapping logs
        ];
        return filters.some((filter) => message.includes(filter));
    }

    log(message: never, ...optionalParameters: never[]): void {
        // Strictly only log Wide Events to satisfy the "only wide event logs" requirement
        if (String(message).includes('WideEvent:')) {
            logger.info(message, ...optionalParameters);
        }
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
        if (String(message).includes('WideEvent:')) {
            logger.debug(message, ...optionalParameters);
        }
    }

    verbose?(message: never, ...optionalParameters: never[]): void {
        if (String(message).includes('WideEvent:')) {
            logger.verbose(message, ...optionalParameters);
        }
    }
}

export default logger;
