import { ContainerLog } from '@kleinkram/backend-common';
import { Injectable } from '@nestjs/common';
import { bufferTime, lastValueFrom, Observable, tap } from 'rxjs';
import logger from '../../logger';
import { DockerDaemon } from './docker-daemon.service';

export interface ActionLogMetadata {
    templateUuid: string;
    missionUuid: string;
    triggerUuid?: string;
}

/**
 * Service for ingesting container logs.
 * Logs are streamed to the logger (Loki) with metadata labels.
 */
@Injectable()
export class LogIngestionService {
    // Batch time in milliseconds for processing logs (e.g. for buffering if needed later)
    private static LOG_WRITE_BATCH_TIME = 100;

    constructor(private readonly dockerDaemon: DockerDaemon) {}

    /**
     * Start ingesting logs from a container.
     *
     * @param containerId The Docker container ID to subscribe to logs from.
     * @param actionUuid The action UUID to associate logs with.
     * @param metadata Additional metadata for log labels.
     * @param sanitizeCallback Optional callback to sanitize log messages (e.g., remove API keys).
     */
    async startIngestion(
        containerId: string,
        actionUuid: string,
        metadata: ActionLogMetadata,
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

        await this.processLogs(
            logsObservable,
            actionUuid,
            metadata,
            containerId,
        );
    }

    /**
     * Process the logs from a container observable.
     * Logs are written to the logger which forwards to Loki.
     */
    private async processLogs(
        logsObservable: Observable<ContainerLog>,
        actionUuid: string,
        metadata: ActionLogMetadata,
        containerId: string,
    ): Promise<void> {
        const containerLogger = logger.child({
            labels: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                container_id: containerId,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                action_run_uuid: actionUuid,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                action_template_uuid: metadata.templateUuid,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                mission_uuid: metadata.missionUuid,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                action_trigger_uuid: metadata.triggerUuid ?? 'manual',
            },
        });

        await lastValueFrom(
            logsObservable.pipe(
                tap((next) =>
                    containerLogger.info({
                        message: next.message,
                        type: next.type,
                        timestamp: next.timestamp,
                    }),
                ),
                bufferTime(LogIngestionService.LOG_WRITE_BATCH_TIME),
                // We keep the buffer structure in case we want to re-add batch processing logic later,
                // but currently we just rely on the tap above to log each line.
                // The subscription needs to stay active, so we use bufferTime to keep the stream flowing safely.
            ),
        ).catch((error: unknown) => {
            logger.error('Error while processing logs:', error);
        });
    }
}
