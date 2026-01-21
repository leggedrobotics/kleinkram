import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { ActionErrorHint, ActionState } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import logger from '../../logger';

interface AuditLog {
    message?: string;
    // other fields irrelevant
}

interface LokiStream {
    stream: Record<string, string>;
    values: [string, string][];
}

@Injectable()
export class ActionErrorHintService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
    ) {}

    async assess(actionUuid: string): Promise<void> {
        try {
            const action = await this.actionRepository.findOne({
                where: { uuid: actionUuid },
                select: [
                    'uuid',
                    'state',
                    'state_cause',
                    'template',
                    'auditLogs',
                ],
                relations: ['template'],
            });

            if (action?.state !== ActionState.FAILED) {
                return;
            }

            let hint: ActionErrorHint | null = null;
            const logs = await this.getLogsFromLoki(actionUuid, 50);

            // 1. Docker Image Not Found
            if (this.checkDockerImageNotFound(action)) {
                hint = ActionErrorHint.DOCKER_IMAGE_NOT_FOUND;
            }
            // 2. CLI Outdated
            else if (this.checkCliOutdated(logs)) {
                hint = ActionErrorHint.CLI_OUTDATED;
            }
            // 3. Memory Limit Exceeded
            else if (this.checkMemoryLimitExceeded(action, logs)) {
                hint = ActionErrorHint.MEMORY_LIMIT_EXCEEDED;
            }

            if (hint) {
                logger.info(
                    `Setting error hint for action ${actionUuid}: ${hint}`,
                );
                await this.actionRepository.update(
                    { uuid: actionUuid },
                    { errorHint: hint },
                );
            }
        } catch (error) {
            logger.error(
                `Failed to assess error hint for action ${actionUuid}: ${String(error)}`,
            );
        }
    }

    private checkDockerImageNotFound(action: ActionEntity): boolean {
        if (!action.state_cause) return false;
        return (
            action.state_cause.includes('failed to resolve reference') &&
            action.state_cause.includes('not found')
        );
    }

    private checkCliOutdated(logs: LogEntry[]): boolean {
        // Loki returns newest first (BACKWARD)
        return logs.some(
            (l) =>
                l.message.includes('Update CLIVersion') ||
                l.message.includes('Please update your CLI') ||
                l.message.includes(
                    'Error downloading data: Please update your CLI',
                ),
        );
    }

    private checkMemoryLimitExceeded(
        action: ActionEntity,
        logs: LogEntry[],
    ): boolean {
        const stateCause = action.state_cause;
        if (
            !stateCause?.includes(
                'Container killed (SIGKILL). Exceeded memory or CPU limit.',
            )
        ) {
            return false;
        }

        // Calculate downloaded size from audit logs
        const auditLogs = (action.auditLogs ?? []) as unknown as AuditLog[];
        let totalDownloadedBytes = 0;

        for (const log of auditLogs) {
            if (log.message?.startsWith('Downloaded ')) {
                const sizePart = log.message.replace('Downloaded ', '');
                const size = Number.parseInt(sizePart, 10);
                if (!Number.isNaN(size)) {
                    totalDownloadedBytes += size;
                }
            }
        }

        // Get memory limit from template (default 2GB if not set)
        const memoryLimitGB = action.template?.cpuMemory ?? 2;
        const memoryLimitBytes = memoryLimitGB * 1024 * 1024 * 1024;

        if (totalDownloadedBytes <= memoryLimitBytes) {
            return false;
        }

        // Check for tqdm progress bar in last 10 lines
        // If logs are newest first (BACKWARD), take first 10
        const lastLogs = logs.slice(0, 10);
        // TQDM progress bars
        return lastLogs.some((l) =>
            /\|\s*\d+(?:\.\d+)?[a-zA-Z]*\/|\[\d{2}:\d{2}<|it\/s|B\/s/.test(
                l.message,
            ),
        );
    }

    private async getLogsFromLoki(
        actionUuid: string,
        limit: number,
    ): Promise<LogEntry[]> {
        try {
            const response = await axios.get<{
                data: { result: LokiStream[] };
            }>('http://loki:3100/loki/api/v1/query_range', {
                params: {
                    query: `{job="queue-consumer", action_run_uuid="${actionUuid}"}`,
                    limit: limit,
                    direction: 'BACKWARD', // Newest first
                },
                timeout: 5000,
            });

            const result = response.data.data.result;
            const streams = Array.isArray(result) ? result : [];

            return streams.flatMap((stream) =>
                stream.values.map((value) => {
                    const [, lineJson] = value;
                    try {
                        const parsed = JSON.parse(lineJson) as {
                            message: string;
                        };
                        return {
                            message: parsed.message,
                        } as LogEntry;
                    } catch {
                        return {
                            message: lineJson,
                        } as LogEntry;
                    }
                }),
            );
        } catch (error) {
            logger.warn(
                `Failed to fetch logs from Loki for hint assessment ${actionUuid}: ${String(
                    error,
                )}`,
            );
            return [];
        }
    }
}

interface LogEntry {
    message: string;
}
