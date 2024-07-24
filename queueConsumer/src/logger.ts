import winston, { format, transports } from 'winston';
import LokiTransport from 'winston-loki';

export const ACTION_CONTAINER_LABEL = 'action_container';
export const QUEUE_CONSUMER_LABEL = 'queue-consumer';

const ignoreContainerLogs = winston.format((info) => {
    if (info?.labels?.job === ACTION_CONTAINER_LABEL) return false;
    return info;
});

const messageOnly = winston.format.printf(({ level, message, label }) => {
    return `[${level.toUpperCase()}]: ${message}`;
});

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
            },
            json: true,
            format: winston.format.json(),
            replaceTimestamp: true,
        }),
    ],
});

export default logger as winston.Logger;
