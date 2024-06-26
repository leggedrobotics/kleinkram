import winston, { format, transports } from 'winston';
import LokiTransport from 'winston-loki';

const messageOnly = winston.format.printf(({ level, message }) => {
    return `[${level.toUpperCase()}]: ${message}`;
});

const logger = winston.createLogger({
    level: 'silly',
    format: format.json(),
    transports: [
        new transports.Console({ format: messageOnly }),
        new LokiTransport({
            host: 'http://loki:3100',
            interval: 5,
            labels: {
                job: 'queue-consumer',
            },
            json: true,
            format: winston.format.json(),
            replaceTimestamp: true,
        }),
    ],
});

export default logger as winston.Logger;
