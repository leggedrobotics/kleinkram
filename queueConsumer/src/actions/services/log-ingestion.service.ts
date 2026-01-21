import { ActionEntity, ContainerLog } from '@kleinkram/backend-common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { bufferTime, concatMap, lastValueFrom, Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { DockerDaemon } from './docker-daemon.service';

/**
 * Service for ingesting container logs and persisting them.
 * Decoupled from ActionManagerService to allow future migration to different sinks.
 */
@Injectable()
export class LogIngestionService {
    // Batch time in milliseconds for writing logs to the database
    private static LOG_WRITE_BATCH_TIME = 100;

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        private readonly dockerDaemon: DockerDaemon,
    ) {}

    /**
     * Start ingesting logs from a container and writing them to the database.
     *
     * @param containerId The Docker container ID to subscribe to logs from.
     * @param actionUuid The action UUID to associate logs with.
     * @param sanitizeCallback Optional callback to sanitize log messages (e.g., remove API keys).
     */
    async startIngestion(
        containerId: string,
        actionUuid: string,
        sanitizeCallback?: (logLine: string) => string,
    ): Promise<void> {
        const logsObservable = await this.dockerDaemon
            .subscribeToLogs(containerId, sanitizeCallback)
            .catch((error: unknown) => {
                logger.error('Error while subscribing to logs:', error);
                return null;
            });

        if (!logsObservable) {
            logger.warn(
                `Could not subscribe to logs for container ${containerId}`,
            );
            return;
        }

        await this.processLogs(logsObservable, actionUuid, containerId);
    }

    /**
     * Process the logs from a container observable and write them to the database.
     * Logs are batched using RxJS bufferTime to reduce DB writes.
     */
    private async processLogs(
        logsObservable: Observable<ContainerLog>,
        actionUuid: string,
        containerId: string,
    ): Promise<void> {
        const containerLogger = logger.child({
            labels: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                container_id: containerId,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                action_uuid: actionUuid || 'unknown',
            },
        });

        await lastValueFrom(
            logsObservable.pipe(
                tap((next) =>
                    containerLogger.info(`[${next.timestamp}] ${next.message}`),
                ),
                bufferTime(LogIngestionService.LOG_WRITE_BATCH_TIME),
                concatMap(async (nextLogBatch: ContainerLog[]) => {
                    await this.writeToSink(actionUuid, nextLogBatch);
                }),
            ),
        ).catch((error: unknown) => {
            logger.error('Error while processing logs:', error);
        });
    }

    /**
     * Write a batch of logs to the current sink (Postgres).
     * This method is encapsulated to allow future migration to other sinks (e.g., S3, Loki).
     */
    private async writeToSink(
        actionUuid: string,
        logBatch: ContainerLog[],
    ): Promise<void> {
        if (logBatch.length === 0) {
            return;
        }

        await this.actionRepository.manager.transaction(async (manager) => {
            const action = await manager.findOne(ActionEntity, {
                where: { uuid: actionUuid },
                select: ['uuid', 'logs'],
                lock: { mode: 'pessimistic_write' },
            });

            if (!action) {
                return;
            }

            const newLogs = [...(action.logs ?? []), ...logBatch];

            await manager.update(
                ActionEntity,
                { uuid: actionUuid },
                { logs: newLogs },
            );
        });
    }
}
