import { ActionEntity, environment } from '@kleinkram/backend-common';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import { ActionState, ImageSource } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Dockerode from 'dockerode';
import { Repository } from 'typeorm';
import logger from '../../logger';
import {
    ContainerEnvironment,
    ContainerLimits,
    ContainerStartOptions,
    DockerDaemon,
} from './docker-daemon.service';

// Label keys for container metadata
export const LABEL_PREFIX = 'kleinkram';
export const LABEL_RUNNER_ID = `${LABEL_PREFIX}.runner_id`;
export const LABEL_ACTION_UUID = `${LABEL_PREFIX}.action_uuid`;
export const LABEL_CREATED_AT = `${LABEL_PREFIX}.created_at`;

// How long before a runner is considered inactive (5 minutes)
const RUNNER_INACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Service for managing container lifecycle with Docker Labels.
 * Implements the "Safe Reaper" reconciliation loop to prevent friendly fire.
 */
@Injectable()
export class ContainerLifecycleService {
    constructor(
        private readonly dockerDaemon: DockerDaemon,
        @InjectRepository(ActionRunnerEntity)
        private actionRunnerRepository: Repository<ActionRunnerEntity>,
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
    ) {}

    /**
     * Start an action container with labels for tracking.
     */
    async startActionContainer(
        runnerId: string,
        action: Readonly<ActionEntity>,
        apiKey: string,
        onProcessing: () => Promise<void>,
    ): Promise<{
        container: Dockerode.Container;
        repoDigests: string[];
        sha: string;
        source: ImageSource;
        localCreatedAt: Date | undefined;
        remoteCreatedAt: Date | undefined;
        containerLimits: ContainerLimits;
        needsGpu: boolean;
        volumeName: string;
        dockerImage: string;
    }> {
        if (!action.template) {
            throw new Error('Action template is undefined');
        }
        if (!action.mission?.project) {
            throw new Error('Mission or project is undefined');
        }

        const environmentVariables: ContainerEnvironment = {
            KLEINKRAM_API_KEY: apiKey,
            KLEINKRAM_PROJECT_UUID: action.mission.project.uuid,
            KLEINKRAM_MISSION_UUID: action.mission.uuid,
            KLEINKRAM_ACTION_UUID: action.uuid,
            KLEINKRAM_API_ENDPOINT: environment.BACKEND_URL,
            KLEINKRAM_S3_ENDPOINT: `https://${environment.MINIO_ENDPOINT}${environment.DEV ? ':9000' : ''}`,
        };

        const labels: Record<string, string> = {
            [LABEL_RUNNER_ID]: runnerId,
            [LABEL_ACTION_UUID]: action.uuid,
            [LABEL_CREATED_AT]: new Date().toISOString(),
        };

        const needsGpu = action.template.gpuMemory > 0;

        const containerOptions: Partial<ContainerStartOptions> = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            docker_image: action.template.image_name,
            name: `${runnerId}-${action.uuid}`,
            limits: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                max_runtime: action.template.maxRuntime * 60 * 60 * 1000,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                n_cpu: action.template.cpuCores || 1,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                memory_limit: Math.ceil(
                    (action.template.cpuMemory || 2) * 1024 * 1024 * 1024,
                ),
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            needs_gpu: needsGpu,
            environment: environmentVariables,
            command: action.template.command ?? '',
            entrypoint: action.template.entrypoint ?? '',
            labels,
        };

        const result = await this.dockerDaemon.startContainer(
            onProcessing,
            containerOptions,
        );

        return {
            ...result,
            dockerImage: action.template.image_name,
        };
    }

    /**
     * The Safe Reaper: Reconciliation loop to clean up zombie containers.
     * Prevents friendly fire between environments by checking runner heartbeats.
     */
    async performReconciliation(currentRunnerId: string): Promise<void> {
        logger.debug('Starting container reconciliation...');

        // Fetch all containers with our prefix
        const containers = await this.dockerDaemon.docker.listContainers({
            all: true,
            filters: {
                label: [`${LABEL_PREFIX}.runner_id`],
            },
        });

        if (containers.length === 0) {
            logger.debug('No kleinkram containers found.');
            return;
        }

        // Fetch all known runners from DB
        const knownRunners = await this.actionRunnerRepository.find({
            select: ['uuid', 'lastSeenAt'],
        });
        const runnerMap = new Map(knownRunners.map((r) => [r.uuid, r]));

        // Fetch all currently active actions
        const activeActions = await this.actionRepository.find({
            where: { state: ActionState.PROCESSING },
            select: ['uuid'],
        });
        const activeActionUuids = new Set(activeActions.map((a) => a.uuid));

        const now = Date.now();

        for (const containerInfo of containers) {
            const labels = containerInfo.Labels;
            const containerRunnerId = labels[LABEL_RUNNER_ID];
            const containerActionUuid = labels[LABEL_ACTION_UUID];

            if (!containerRunnerId || !containerActionUuid) {
                // Legacy container without proper labels - apply old logic (kill if > 24h)
                await this.handleLegacyContainer(containerInfo);
                continue;
            }

            // Case 1: My Container
            if (containerRunnerId === currentRunnerId) {
                if (!activeActionUuids.has(containerActionUuid)) {
                    logger.info(
                        `[Reaper] Killing zombie container ${containerInfo.Id} (action ${containerActionUuid} not active)`,
                    );
                    await this.dockerDaemon.killAndRemoveContainer(
                        containerInfo.Id,
                    );
                    await this.markActionAsFailed(
                        containerActionUuid,
                        'Container killed by Reaper: action no longer active',
                    );
                }
                continue;
            }

            // Case 2: Known Runner (but not me)
            const runner = runnerMap.get(containerRunnerId);
            if (runner) {
                const lastSeen = runner.lastSeenAt.getTime();
                const isInactive =
                    now - lastSeen > RUNNER_INACTIVE_THRESHOLD_MS;

                if (isInactive) {
                    logger.info(
                        `[Reaper] Killing container ${containerInfo.Id} from inactive runner ${containerRunnerId}`,
                    );
                    await this.dockerDaemon.killAndRemoveContainer(
                        containerInfo.Id,
                    );
                    await this.markActionAsFailed(
                        containerActionUuid,
                        'Interrupted by new Runner Instance (old runner inactive)',
                        137,
                    );
                } else {
                    logger.debug(
                        `[Reaper] Ignoring container ${containerInfo.Id} from active runner ${containerRunnerId}`,
                    );
                }
                continue;
            }

            // Case 3: Unknown Runner (different environment)
            logger.debug(
                `[Reaper] Ignoring container ${containerInfo.Id} from unknown runner ${containerRunnerId} (likely different environment)`,
            );
        }

        logger.debug('Container reconciliation complete.');
    }

    /**
     * Handle legacy containers without proper labels.
     * Kill if older than 24 hours.
     */
    private async handleLegacyContainer(
        containerInfo: Dockerode.ContainerInfo,
    ): Promise<void> {
        const createdAt = new Date(containerInfo.Created * 1000);
        const ageMs = Date.now() - createdAt.getTime();
        const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

        if (ageMs > MAX_AGE_MS) {
            logger.info(
                `[Reaper] Killing legacy container ${containerInfo.Id} (older than 24h)`,
            );
            await this.dockerDaemon.killAndRemoveContainer(containerInfo.Id);
        } else {
            logger.debug(
                `[Reaper] Ignoring legacy container ${containerInfo.Id} (less than 24h old)`,
            );
        }
    }

    /**
     * Mark an action as failed in the database.
     */
    private async markActionAsFailed(
        actionUuid: string,
        cause: string,
        exitCode?: number,
    ): Promise<void> {
        await this.actionRepository.update(
            { uuid: actionUuid },
            {
                state: ActionState.FAILED,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause: cause,
                ...(exitCode !== undefined && {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    exit_code: exitCode,
                }),
            },
        );
    }

    /**
     * Stop a container gracefully.
     */
    async stopContainer(containerId: string): Promise<void> {
        await this.dockerDaemon.stopContainer(containerId);
    }

    /**
     * Kill and remove a container.
     */
    async killAndRemoveContainer(containerId: string): Promise<void> {
        await this.dockerDaemon.killAndRemoveContainer(containerId);
    }

    /**
     * Remove a container.
     */
    removeContainer(containerId: string, clearVolume = false): void {
        this.dockerDaemon.removeContainer(containerId, clearVolume);
    }
}
