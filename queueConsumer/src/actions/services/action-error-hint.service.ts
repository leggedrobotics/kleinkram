import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { ActionErrorHint, ActionState } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../../logger';

interface AuditLog {
    message?: string;
    // other fields irrelevant
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
                    'logs',
                    'auditLogs',
                ],
                relations: ['template'],
            });

            if (action?.state !== ActionState.FAILED) {
                return;
            }

            let hint: ActionErrorHint | null = null;

            // 1. Docker Image Not Found
            if (this.checkDockerImageNotFound(action)) {
                hint = ActionErrorHint.DOCKER_IMAGE_NOT_FOUND;
            }
            // 2. CLI Outdated
            else if (this.checkCliOutdated(action)) {
                hint = ActionErrorHint.CLI_OUTDATED;
            }
            // 3. Memory Limit Exceeded
            else if (this.checkMemoryLimitExceeded(action)) {
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

    private checkCliOutdated(action: ActionEntity): boolean {
        const logs = action.logs;
        if (!logs) return false;

        const lastLogs = logs.slice(-25);
        return lastLogs.some(
            (l) =>
                l.message.includes('Update CLIVersion') ||
                l.message.includes('Please update your CLI') ||
                l.message.includes(
                    'Error downloading data: Please update your CLI',
                ),
        );
    }

    private checkMemoryLimitExceeded(action: ActionEntity): boolean {
        const stateCause = action.state_cause;
        if (
            !stateCause?.includes(
                'Container killed (SIGKILL). Exceeded memory or CPU limit.',
            )
        ) {
            return false;
        }

        // Calculate downloaded size from audit logs
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
        const logs = action.logs ?? [];
        const lastLogs = logs.slice(-10);
        // TQDM progress bars typically look like: "10%|#         | 10/100 [00:01<00:09,  9.00it/s]"
        // Or for files: "100%|##########| 1.00G/1.00G [00:10<00:00, 100MB/s]"
        return lastLogs.some((l) =>
            /\|\s*\d+(?:\.\d+)?[a-zA-Z]*\/|\[\d{2}:\d{2}<|it\/s|B\/s/.test(
                l.message,
            ),
        );
    }
}
