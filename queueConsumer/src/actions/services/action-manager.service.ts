import { tracing } from '@/tracing';
import {
    AccessControlService,
    ActionEntity,
    ApiKeyEntity,
    Image,
} from '@kleinkram/backend-common';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import { transitionAction } from '@kleinkram/backend-common/services/action-state-transition';
import {
    ActionOutcome,
    ActionSeverity,
    ActionState,
    ActionStateCause,
    ArtifactState,
    KeyTypes,
    maxActionSeverity,
    resolveActionOutcome,
    ResourceUsage,
    rightsRequiredToRunAction,
    StateCauseError,
    stateCauseOfError,
    TERMINAL_ACTION_STATES,
    UserRole,
} from '@kleinkram/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Dockerode from 'dockerode';
import fs from 'node:fs';
import path from 'node:path';
import si from 'systeminformation';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { DisposableAPIKey } from '../helper/disposable-api-key';
import { WideLogger } from '../helper/wide-logger';
import { ActionCancellationService } from './action-cancellation.service';
import { ActionErrorHintService } from './action-error-hint.service';
import { ArtifactService } from './artifact.service';
import { ContainerLifecycleService } from './container-lifecycle.service';
import { ContainerStatsService } from './container-stats.service';
import { DockerDaemon } from './docker-daemon.service';
import { LogIngestionService } from './log-ingestion.service';

@Injectable()
export class ActionManagerService implements OnModuleInit {
    private currentInstanceId: string | undefined;
    private initPromise!: Promise<void>;

    /**
     * Keys handed to action containers that run on this worker right now, so
     * a shutdown can revoke them before the process exits.
     */
    private readonly liveKeys = new Set<DisposableAPIKey>();

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        @InjectRepository(ActionRunnerEntity)
        private actionRunnerRepository: Repository<ActionRunnerEntity>,
        private accessControlService: AccessControlService,
        private readonly containerLifecycleService: ContainerLifecycleService,
        private readonly actionErrorHintService: ActionErrorHintService,
        private readonly logIngestionService: LogIngestionService,
        private readonly artifactService: ArtifactService,
        private readonly containerStatsService: ContainerStatsService,
        private readonly dockerDaemon: DockerDaemon,
        private readonly cancellationService: ActionCancellationService,
    ) {}

    async onModuleInit(): Promise<void> {
        this.initPromise = this.registerRunner();
        await this.initPromise;
        await this.revokeStaleActionKeys();
    }

    /**
     * Revokes every action key whose action is no longer running.
     *
     * A key is normally revoked in the `finally` of the run that created it.
     * A worker that dies without reaching it (SIGKILL, OOM, lost node) leaves
     * the key valid. The janitor later marks such an action as failed, and the
     * next sweep then revokes its key. Safe to run on every worker at once:
     * keys of actions that are still running are never touched, wherever they
     * run.
     *
     * Also revokes keys that lost their action (deleted, or replaced by a
     * newer key when the action was retried). Creating a key and linking it
     * to its action happen in one transaction, so a fresh key is never seen
     * without its action.
     */
    async revokeStaleActionKeys(): Promise<void> {
        try {
            const result = await this.apikeyRepository
                .createQueryBuilder()
                .update()
                .set({ deletedAt: () => 'now()' })
                .where('"key_type" = :keyType', { keyType: KeyTypes.ACTION })
                .andWhere('"deletedAt" IS NULL')
                .andWhere(
                    `NOT EXISTS (
                        SELECT 1 FROM "action" "a"
                        WHERE "a"."keyUuid" = "apikey"."uuid"
                          AND "a"."deletedAt" IS NULL
                          AND "a"."state" NOT IN (:...terminalStates)
                    )`,
                    { terminalStates: TERMINAL_ACTION_STATES },
                )
                .execute();
            if (result.affected) {
                logger.info(
                    `Revoked ${result.affected.toString()} stale action API key(s)`,
                );
            }
        } catch (error) {
            logger.error(
                `Failed to revoke stale action API keys: ${String(error)}`,
            );
        }
    }

    /**
     * Revokes the keys of all actions running on this worker. Called on
     * SIGTERM: the process exits right after, so the `finally` that would
     * normally revoke them never runs. The containers are left behind, and the
     * janitor of the next runner kills them, so the runs are lost anyway.
     */
    async revokeLiveKeys(): Promise<void> {
        await Promise.allSettled(
            [...this.liveKeys].map((key) => key[Symbol.asyncDispose]()),
        );
    }

    private async registerRunner(): Promise<void> {
        const osInfo = await si.osInfo();
        const hostname = osInfo.hostname;

        let packageJsonVersion = 'unknown';
        try {
            const packageJsonPath = path.resolve(
                __dirname,
                '../../../package.json',
            );
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, 'utf8'),
            ) as { version: string };
            packageJsonVersion = packageJson.version;
        } catch (error) {
            logger.warn(
                `Failed to read package.json version: ${String(error)}`,
            );
        }

        const gitHash = process.env.GIT_COMMIT ?? 'unknown';

        // Let DB generate UUID
        const runner = this.actionRunnerRepository.create({
            hostname,
            version: packageJsonVersion,
            gitHash,
            startedAt: new Date(),
            lastSeenAt: new Date(),
        });
        const savedRunner = await this.actionRunnerRepository.save(runner);
        this.currentInstanceId = savedRunner.uuid;
        logger.info(
            `Action Runner registered with ID: ${this.currentInstanceId}`,
        );
    }

    /**
     * Get the current runner instance ID.
     */
    getCurrentInstanceId(): string | undefined {
        return this.currentInstanceId;
    }

    /**
     * Update the heartbeat timestamp for the current runner.
     */
    async updateHeartbeat(): Promise<void> {
        await this.initPromise;
        if (!this.currentInstanceId) {
            return;
        }
        await this.actionRunnerRepository.update(
            { uuid: this.currentInstanceId },
            { lastSeenAt: new Date() },
        );
    }

    /**
     * Creates a new API key for the given action.
     * The API key is used to authenticate the action container.
     *
     * The API key is automatically deleted when the action is completed.
     *
     * @param action
     */
    @tracing('create_apikey')
    async createAPIkey(action: ActionEntity): Promise<DisposableAPIKey> {
        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }

        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }

        if (action.creator === undefined) {
            throw new Error('User is undefined');
        }

        // Re-checks what the submit guard already checked, because the creator
        // may have lost access while the action sat in the queue. Running an
        // action counts as a write operation on the mission, so Write is the
        // floor even for a Read-level template; a higher template level raises
        // it, since the key below must never carry more than its creator holds.
        const canRunAction = await this.accessControlService.canAccessMission(
            {
                uuid: action.creator.uuid,
                role: action.creator.role ?? UserRole.USER,
            },
            action.mission,
            rightsRequiredToRunAction(action.template.accessRights),
        );
        if (!canRunAction) {
            throw new StateCauseError({
                code: ActionStateCause.MISSION_ACCESS_LOST,
            });
        }

        const apiKey = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            rights: action.template.accessRights,

            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            action: action,
            user: action.creator,
        });
        return new DisposableAPIKey(
            await this.apikeyRepository.save(apiKey),
            this.apikeyRepository,
        );
    }

    @tracing('processing_action')
    async processAction(action: Readonly<ActionEntity>): Promise<boolean> {
        this.cancellationService.registerAction(action.uuid);
        try {
            return await this.executeProcessAction(action);
        } finally {
            this.cancellationService.cleanup(action.uuid);
        }
    }

    private async executeProcessAction(
        action: Readonly<ActionEntity>,
    ): Promise<boolean> {
        const wideLog = new WideLogger('action_processed', {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            action_uuid: action.uuid,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            mission_uuid: action.mission?.uuid,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            project_uuid: action.mission?.project?.uuid,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            template_name: action.template?.name,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            creator_uuid: action.creator?.uuid,
        });

        await this.initPromise;
        if (!this.currentInstanceId) {
            const error = new Error(
                'ActionManagerService not initialized: currentInstanceId is missing',
            );
            wideLog.recordError(error);
            wideLog.flush('error');
            throw error;
        }

        wideLog.add({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            runner_id: this.currentInstanceId,
        });

        logger.debug(`Processing Action ${action.uuid}`);

        if (action.state !== ActionState.PENDING) {
            const error = new Error(
                `Action state is not 'PENDING'. Current state: ${action.state}`,
            );
            wideLog.add({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                actual_state: action.state,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                trigger_source: action.triggerSource,
            });
            wideLog.recordError(error);
            wideLog.flush('error');
            throw error;
        }

        if (this.cancellationService.isCancelled(action.uuid)) {
            logger.info(`Action ${action.uuid} was cancelled before starting`);
            await transitionAction(this.actionRepository.manager, action.uuid, {
                state: ActionState.CANCELLED,
                cause: { code: ActionStateCause.CANCELLED_BY_USER },
            });
            this.cancellationService.cleanup(action.uuid);
            return true;
        }

        await transitionAction(this.actionRepository.manager, action.uuid, {
            state: ActionState.STARTING,
            cause: { code: ActionStateCause.STARTING },
        });

        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }
        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }
        if (action.creator === undefined) {
            throw new Error('User is undefined');
        }
        if (action.mission.project === undefined) {
            throw new Error('Project is undefined');
        }

        const apikey = await this.createAPIkey(action);
        this.liveKeys.add(apikey);
        try {
            const {
                container,
                repoDigests,
                sha,
                source,
                localCreatedAt,
                remoteCreatedAt,
                containerLimits,
                needsGpu,
                volumeName,
                dockerImage,
            } = await this.containerLifecycleService.startActionContainer(
                this.currentInstanceId,
                action,
                apikey.apikey,
                async () => {
                    await transitionAction(
                        this.actionRepository.manager,
                        action.uuid,
                        {
                            state: ActionState.PROCESSING,
                            cause: { code: ActionStateCause.RUNNING },
                        },
                    );
                },
            );

            this.cancellationService.registerContainer(action.uuid, container);

            if (this.cancellationService.isCancelled(action.uuid)) {
                logger.info(
                    `Action ${action.uuid} was cancelled during container start. Killing container...`,
                );
                try {
                    await container.kill();
                } catch (error) {
                    logger.error(
                        `Failed to kill container ${container.id} for action ${action.uuid}: ${String(error)}`,
                    );
                }
            }

            wideLog.add({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                container_id: container.id,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                image_sha: sha,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                image_source: source,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                needs_gpu: needsGpu,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                volume_name: volumeName,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                docker_image: dockerImage,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                memory_limit: containerLimits.memory_limit,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                n_cpu: containerLimits.n_cpu,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                max_runtime: containerLimits.max_runtime,
            });

            // capture runner information
            const actionImage: Image = {
                repoDigests: repoDigests,
                sha,
                source,
                localCreatedAt,
                remoteCreatedAt,
            };
            const { executionStartedAt, container: actionContainer } =
                await this.getContainerInfo(container);
            await this.actionRepository.update(
                { uuid: action.uuid },

                {
                    executionStartedAt,
                    actionContainerStartedAt: executionStartedAt,
                    container: actionContainer,
                    image: actionImage,
                },
            );

            // eslint-disable-next-line @typescript-eslint/naming-convention
            const sanitize = (string_: string): string => {
                return string_.replaceAll(apikey.apikey, '***');
            };

            let lastStatsUpdate = 0;
            const statsUpdateInterval = 2000;

            // Start stats collection BEFORE log ingestion (which blocks until container exit)
            const statsPromise = this.containerStatsService
                .collectStats(container, (stats) => {
                    const now = Date.now();
                    if (now - lastStatsUpdate > statsUpdateInterval) {
                        lastStatsUpdate = now;
                        void this.saveActionStats(action, stats);
                    }
                })
                .catch((error: unknown) => {
                    logger.warn(
                        `Failed to collect stats for ${action.uuid}: ${String(
                            error,
                        )}`,
                    );
                    return null;
                });

            // Delegate log ingestion to LogIngestionService
            // Note: If startIngestion blocks until container exit, stats collection must be started BEFORE this.
            await this.logIngestionService.startIngestion(
                container.id,
                action.uuid,
                {
                    templateUuid: action.template.uuid,
                    missionUuid: action.mission.uuid,
                    triggerUuid: action.triggerUuid ?? undefined,
                },
                sanitize,
            );

            // wait for the container to stop
            await container.wait();

            // Give the stats stream a moment to finish flushing after container exit
            // using a race to prevent infinite hanging
            const statsResult = await Promise.race([
                statsPromise,
                new Promise<null>((resolve) =>
                    setTimeout(() => {
                        logger.warn(
                            `Stats collection timed out for ${action.uuid}`,
                        );
                        resolve(null);
                    }, 10_000),
                ),
            ]);

            // update action state based on container exit code
            action = await this.actionRepository.findOneOrFail({
                where: { uuid: action.uuid },
                relations: {
                    worker: true,
                    template: true,
                },
            });

            if (!this.cancellationService.isCancelled(action.uuid)) {
                // Conditional, because the janitor may have already failed this
                // action - it is what killed the container we just stopped
                // waiting on. Writing STOPPING unconditionally would erase that
                // verdict before setActionState can read it back.
                await transitionAction(
                    this.actionRepository.manager,
                    action.uuid,
                    {
                        state: ActionState.STOPPING,
                        cause: { code: ActionStateCause.STOPPING },
                        unlessIn: TERMINAL_ACTION_STATES,
                    },
                );
            }

            this.containerLifecycleService.removeContainer(container.id, true);
            await this.setActionState(container, action, wideLog);

            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    executionEndedAt: new Date(),
                    actionContainerExitedAt: new Date(),
                },
            );

            if (statsResult) {
                await this.saveActionStats(action, statsResult, wideLog);
                logger.debug(
                    `Stats collected and saved for action ${
                        action.uuid
                    }: ${String(statsResult.samples.length)} samples`,
                );
            } else {
                logger.warn(
                    `Stats collection failed or timed out for action ${action.uuid}`,
                );
                // If timed out, still try to save if it finishes later
                statsPromise
                    .then(async (lateResult) => {
                        if (lateResult) {
                            logger.debug(
                                `Late stats arrived for ${action.uuid}, saving...`,
                            );
                            await this.saveActionStats(
                                action,
                                lateResult,
                                wideLog,
                            );
                        }
                    })
                    .catch((error: unknown) => {
                        logger.warn(
                            `Failed to save late stats for ${
                                action.uuid
                            }: ${String(error)}`,
                        );
                    });
            }

            if (action.template === undefined) {
                throw new Error('Template is undefined');
            }

            if (this.cancellationService.isCancelled(action.uuid)) {
                logger.info(
                    `Action ${action.uuid} was cancelled, skipping artifact upload and cleaning volume`,
                );
                await this.dockerDaemon
                    .removeArtifactVolume(this.currentInstanceId, action.uuid)
                    .catch((error: unknown) => {
                        logger.warn(
                            `Failed to clean up artifact volume: ${String(error)}`,
                        );
                    });
                await this.actionRepository.update(
                    { uuid: action.uuid },
                    { artifacts: ArtifactState.ERROR },
                );
                this.cancellationService.cleanup(action.uuid);
            } else {
                // Delegate artifact upload to ArtifactService
                const {
                    artifactSize,
                    artifactFiles,
                    containerLimits: artifactContainerLimits,
                } = await this.artifactService.uploadArtifacts(
                    action.uuid,
                    this.currentInstanceId,
                );

                wideLog.add({
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    artifact_size: artifactSize,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    artifact_files: artifactFiles?.length,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    artifact_memory_limit: artifactContainerLimits.memory_limit,
                });
            }

            wideLog.flush();

            return true; // Mark the job as completed
        } catch (error: unknown) {
            wideLog.recordError(error);
            wideLog.flush('error');

            if (this.cancellationService.isCancelled(action.uuid)) {
                await transitionAction(
                    this.actionRepository.manager,
                    action.uuid,
                    {
                        state: ActionState.CANCELLED,
                        cause: { code: ActionStateCause.CANCELLED_BY_USER },
                    },
                );
                this.cancellationService.cleanup(action.uuid);
            } else {
                // The run threw before or around the container rather than
                // inside it: image pulls, storage, the daemon - or a cause that
                // knows better, such as the creator having lost access.
                await transitionAction(
                    this.actionRepository.manager,
                    action.uuid,
                    {
                        state: ActionState.FAILED,
                        cause: stateCauseOfError(error),
                        set: { severity: ActionSeverity.ERROR },
                    },
                );
                // Trigger hint assessment asynchronously
                void this.actionErrorHintService.assess(action.uuid);
            }
            throw error;
        } finally {
            this.cancellationService.unregisterContainer(action.uuid);
            await apikey[Symbol.asyncDispose]();
            this.liveKeys.delete(apikey);
        }
    }

    /**
     * Inspects the container and sets the container information to the action
     * object. This function does not save the action to the database!
     *
     * @param container
     * @private
     */
    private async getContainerInfo(container: Dockerode.Container): Promise<{
        executionStartedAt: Date;
        container: { id: string };
    }> {
        const containerId = container.id;
        const containerDetails = await container.inspect();

        return {
            executionStartedAt: new Date(containerDetails.Created),
            container: { id: containerId },
        };
    }

    /**
     * Sets the state of the action based on the container exit code.
     */
    private async saveActionStats(
        action: Readonly<ActionEntity>,
        statsResult: ResourceUsage,
        wideLog?: WideLogger,
    ): Promise<void> {
        const memoryLimitBytes =
            (action.template?.cpuMemory ?? 2) * 1024 * 1024 * 1024;
        const efficiencyScore =
            memoryLimitBytes > 0
                ? statsResult.maxMemoryBytes / memoryLimitBytes
                : 0;

        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                resourceUsage: statsResult,
                maxMemoryBytes: statsResult.maxMemoryBytes,
                avgCpuPercent: statsResult.avgCpuPercent,
                efficiencyScore: efficiencyScore,
            },
        );

        if (wideLog) {
            wideLog.add({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                resource_max_ram_bytes: statsResult.maxMemoryBytes,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                resource_avg_cpu_percent: statsResult.avgCpuPercent,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                resource_max_cpu_percent: statsResult.maxCpuPercent,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                resource_efficiency_score: efficiencyScore,
            });
        }
    }

    private async setActionState(
        container: Dockerode.Container,
        action: Readonly<ActionEntity>,
        wideLog: WideLogger,
    ): Promise<void> {
        const containerDetailsAfter = await container.inspect();
        const exitCode = containerDetailsAfter.State.ExitCode;

        const outcome: ActionOutcome = this.cancellationService.isCancelled(
            action.uuid,
        )
            ? {
                  state: ActionState.CANCELLED,
                  severity: ActionSeverity.OK,
                  cause: { code: ActionStateCause.CANCELLED_BY_USER },
              }
            : resolveActionOutcome({
                  exitCode,
                  oomKilled: containerDetailsAfter.State.OOMKilled,
              });

        // A verdict the janitor already recorded - time limit exceeded, runner
        // replaced - wins over anything the exit code implies: by now the exit
        // code only says how the container died, a 137 or a 143.
        const applied = await transitionAction(
            this.actionRepository.manager,
            action.uuid,
            {
                state: outcome.state,
                cause: outcome.cause,
                unlessIn: TERMINAL_ACTION_STATES,
            },
        );

        // The container may have reported diagnostics while it ran, which
        // already raised the severity stored for the action. The exit code can
        // only ever raise it further, never talk it back down - so an outcome
        // of OK leaves the column alone rather than writing a value read
        // before the last diagnostic may have landed.
        const stored = await this.actionRepository.findOne({
            where: { uuid: action.uuid },
            select: { uuid: true, severity: true },
        });
        const severity = maxActionSeverity(
            stored?.severity ?? ActionSeverity.OK,
            outcome.severity,
        );
        const raisesSeverity = outcome.severity !== ActionSeverity.OK;

        wideLog.add({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            exit_code: exitCode,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            final_state: outcome.state,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            final_severity: severity,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            failure_origin: outcome.failureOrigin ?? '',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            state_cause: outcome.cause.code,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            recorded_verdict_kept: !applied,
        });

        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                ...(raisesSeverity && { severity }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                exit_code: exitCode,
            },
        );
    }
}
