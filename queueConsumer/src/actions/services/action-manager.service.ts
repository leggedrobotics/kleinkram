import { tracing } from '@/tracing';
import {
    AccessControlService,
    ActionEntity,
    ApiKeyEntity,
    ContainerLog,
    environment,
    Image,
} from '@kleinkram/backend-common';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import {
    AccessGroupRights,
    ActionState,
    ArtifactState,
    KeyTypes,
    UserRole,
} from '@kleinkram/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Dockerode from 'dockerode';
import fs from 'node:fs';
import path from 'node:path';
import { bufferTime, concatMap, lastValueFrom, Observable, tap } from 'rxjs';
import si from 'systeminformation';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { DisposableAPIKey } from '../helper/disposable-api-key';
import { ActionErrorHintService } from './action-error-hint.service';
import {
    ContainerEnvironment,
    DockerDaemon,
    dockerDaemonErrorHandler,
} from './docker-daemon.service';

@Injectable()
export class ActionManagerService implements OnModuleInit {
    // we will write logs to the database every 100 milliseconds
    private static LOG_WRITE_BATCH_TIME = 100;
    private currentInstanceId: string | undefined;
    private initPromise!: Promise<void>;

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        @InjectRepository(ActionRunnerEntity)
        private actionRunnerRepository: Repository<ActionRunnerEntity>,
        private accessControlService: AccessControlService,
        private readonly containerDaemon: DockerDaemon,
        private readonly actionErrorHintService: ActionErrorHintService,
    ) {}

    async onModuleInit(): Promise<void> {
        this.initPromise = this.registerRunner();
        await this.initPromise;
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

        const hasWriteAccess = await this.accessControlService.canAccessMission(
            {
                uuid: action.creator.uuid,
                role: action.creator.role ?? UserRole.USER,
            },
            action.mission,
            AccessGroupRights.WRITE,
        );
        if (!hasWriteAccess) {
            throw new Error(
                `User ${action.creator.uuid} lost access to mission ${action.mission.uuid}`,
            );
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

    // eslint-disable-next-line complexity
    @tracing('processing_action')
    async processAction(action: Readonly<ActionEntity>): Promise<boolean> {
        await this.initPromise;
        if (!this.currentInstanceId) {
            throw new Error(
                'ActionManagerService not initialized: currentInstanceId is missing',
            );
        }

        logger.info(`\n\nProcessing Action ${action.uuid}`);

        logger.info('Creating container.');

        if (action.state !== ActionState.PENDING) {
            logger.error(
                `Action ${action.uuid} state is '${action.state}' (expected 'PENDING'). Trigger source: ${action.triggerSource}`,
            );
            throw new Error(
                `Action state is not 'PENDING'. Current state: ${action.state}`,
            );
        }

        // set state to 'STARTING'
        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                state: ActionState.STARTING,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause: 'Action is currently running...',
            },
        );

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
        try {
            const environmentVariables: ContainerEnvironment = {
                KLEINKRAM_API_KEY: apikey.apikey,
                KLEINKRAM_PROJECT_UUID: action.mission.project.uuid,
                KLEINKRAM_MISSION_UUID: action.mission.uuid,
                KLEINKRAM_ACTION_UUID: action.uuid,
                KLEINKRAM_API_ENDPOINT: environment.BACKEND_URL,
                KLEINKRAM_S3_ENDPOINT: `https://${environment.MINIO_ENDPOINT}${environment.DEV ? ':9000' : ''}`,
            };
            const needsGpu = action.template.gpuMemory > 0;
            const {
                container,
                repoDigests,
                sha,
                source,
                localCreatedAt,
                remoteCreatedAt,
            } = await this.containerDaemon.startContainer(
                async () => {
                    await this.actionRepository.update(
                        { uuid: action.uuid },
                        { state: ActionState.PROCESSING },
                    );
                },

                {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    docker_image: action.template.image_name,
                    name: `${this.currentInstanceId}-${action.uuid}`,

                    limits: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        max_runtime:
                            action.template.maxRuntime * 60 * 60 * 1000, // Hours to milliseconds
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        n_cpu: action.template.cpuCores || 1,

                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        memory_limit: Math.ceil(
                            (action.template.cpuMemory || 2) *
                                1024 *
                                1024 *
                                1024,
                        ), // min 2 GB
                    },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    needs_gpu: needsGpu,
                    environment: environmentVariables,
                    command: action.template.command ?? '',
                    entrypoint: action.template.entrypoint ?? '',
                },
            );

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
                return string_.replace(apikey.apikey, '***');
            };

            // get logs from container and save them to the database
            const logsObservable = await this.containerDaemon
                .subscribeToLogs(container.id, sanitize)
                .catch((error: unknown) => {
                    logger.error('Error while subscribing to logs:', error);
                });

            if (!logsObservable) {
                const containerInfo = await container
                    .inspect()
                    .catch(() => null);

                if (containerInfo) {
                    if (containerInfo.State.OOMKilled) {
                        throw new Error(
                            'Container was killed due to memory constraints (OOMKilled). Container logs are not available.',
                        );
                    }
                    if (containerInfo.State.ExitCode === 137) {
                        throw new Error(
                            'Container was killed (Exit Code 137). Likely due to memory constraints or manual termination. Logs are not available.',
                        );
                    }
                }

                throw new Error(
                    'Container logs are not available. Container might never have been started correctly.',
                );
            }

            await this.processContainerLogs(
                logsObservable,
                action.uuid,
                container.id,
            );

            // wait for the container to stop
            await container.wait();

            // update action state based on container exit code
            action = await this.actionRepository.findOneOrFail({
                where: { uuid: action.uuid },
                relations: ['worker', 'template'],
            });

            await this.actionRepository.update(
                { uuid: action.uuid },
                { state: ActionState.STOPPING },
            );

            this.containerDaemon.removeContainer(container.id, true);
            await this.setActionState(container, action);

            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    executionEndedAt: new Date(),
                    actionContainerExitedAt: new Date(),
                    artifacts: ArtifactState.UPLOADING,
                },
            );

            if (action.template === undefined) {
                throw new Error('Template is undefined');
            }

            const { container: artifactUploadContainer, artifactMetadata } =
                await this.containerDaemon.launchArtifactUploadContainer(
                    action.uuid,
                );
            await artifactUploadContainer.wait();
            this.containerDaemon.removeContainer(artifactUploadContainer.id);

            await this.containerDaemon.removeVolume(action.uuid);

            const bucketName = environment.MINIO_ARTIFACTS_BUCKET_NAME;

            const filename = `${action.uuid}.tar.gz`;
            const artifactPath = `/${bucketName}/${filename}`;

            const updateData: {
                artifacts: ArtifactState;
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_path: string;
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_size?: number;
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_files?: string[];
            } = {
                artifacts: ArtifactState.UPLOADED,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_path: artifactPath,
            };

            if (artifactMetadata?.size !== undefined) {
                updateData.artifact_size = artifactMetadata.size;
            }
            if (artifactMetadata?.files !== undefined) {
                updateData.artifact_files = artifactMetadata.files;
            }

            await this.actionRepository.update(
                { uuid: action.uuid },
                updateData,
            );

            return true; // Mark the job as completed
        } catch (error: unknown) {
            logger.error(`Failed to process action: ${String(error)}`);
            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    state: ActionState.FAILED,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    state_cause:
                        error instanceof Error ? error.message : String(error),
                },
            );
            // Trigger hint assessment asynchronously
            void this.actionErrorHintService.assess(action.uuid);
            throw error;
        } finally {
            await apikey[Symbol.asyncDispose]();
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
     * Process the logs from the container and save them to the database.
     * The logs are written to the database periodically to reduce the
     * number of writes.
     *
     * The logs are also written to the logger service tagged with the
     * containerId and actionUuid.
     *
     // eslint-disable-next-line @typescript-eslint/naming-convention
     * @param logsObservable
     * @param actionUuid
     // eslint-disable-next-line @typescript-eslint/naming-convention
     * @param containerId
     * @private
     */
    private async processContainerLogs(
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
                bufferTime(ActionManagerService.LOG_WRITE_BATCH_TIME),
                concatMap(async (nextLogBatch: ContainerLog[]) => {
                    // new transaction for each batch
                    await this.actionRepository.manager.transaction(
                        async (manager) => {
                            const _action = await manager.findOne(
                                ActionEntity,
                                {
                                    where: { uuid: actionUuid },
                                    select: ['uuid', 'logs'],
                                    lock: { mode: 'pessimistic_write' },
                                },
                            );

                            if (!_action) {
                                return;
                            }

                            const newLogs = [
                                ...(_action.logs ?? []),
                                ...nextLogBatch,
                            ];

                            await manager.update(
                                ActionEntity,
                                { uuid: actionUuid },
                                { logs: newLogs },
                            );
                        },
                    );
                }),
            ),
        ).catch((error: unknown) => {
            logger.error('Error while processing logs:', error);
        });
    }

    /**
     * Sets the state of the action based on the container exit code.
     * This function does not save the action to the database!
     *
     // eslint-disable-next-line @typescript-eslint/naming-convention
     */

    private async setActionState(
        container: Dockerode.Container,
        action: Readonly<ActionEntity>,
    ): Promise<void> {
        const containerDetailsAfter = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${containerDetailsAfter.State.ExitCode.toString()}`,
        );

        const exitCode = containerDetailsAfter.State.ExitCode;

        let state: ActionState;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let exit_code: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let state_cause: string;

        switch (exitCode) {
            case 125: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container failed to run. Docker run command failed.';
                break;
            }
            case 126: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause = 'Command cannot be invoked (Permission denied?).';
                break;
            }
            case 127: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause = 'Command not found.';
                break;
            }
            case 139: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container crashed (SIGSEGV). Invalid memory access.';
                break;
            }
            case 143: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container stopped (SIGTERM). Time limit approached.';
                break;
            }
            case 137: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container killed (SIGKILL). Exceeded memory or CPU limit.';
                break;
            }
            default: {
                state_cause = `Container exited with code ${exitCode.toString()}`;
                state = exitCode === 0 ? ActionState.DONE : ActionState.FAILED;
                exit_code = exitCode;
            }
        }
        logger.warn(`Action ${action.uuid} has failed with exit code 125`);
        logger.warn(action.state_cause);

        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                state,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                exit_code,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause,
            },
        );
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    async cleanupContainers(): Promise<void> {
        await this.initPromise;
        if (!this.currentInstanceId) {
            throw new Error(
                'ActionManagerService not initialized: currentInstanceId is missing',
            );
        }

        logger.debug('Cleanup containers and dangling actions...');

        // Update heartbeat
        await this.actionRunnerRepository.update(
            { uuid: this.currentInstanceId },
            { lastSeenAt: new Date() },
        );

        const containers = await this.containerDaemon.docker
            .listContainers({ all: true })
            .catch(dockerDaemonErrorHandler);

        const runningActionContainers: Dockerode.ContainerInfo[] =
            containers?.filter((container: Dockerode.ContainerInfo) =>
                container.Names[0]?.startsWith(
                    `/${DockerDaemon.CONTAINER_PREFIX}`,
                ),
            ) ?? [];
        //////////////////////////////////////////////////////////////////////////////
        // Find crashed containers
        //////////////////////////////////////////////////////////////////////////////

        const actionIds = new Set(
            runningActionContainers.map((container) => {
                const { actionUuid } = this.parseContainerName(
                    container.Names[0] ?? '',
                );
                return actionUuid;
            }),
        );
        const { hostname: name } = await si.osInfo();
        const actionsInLocalProcess = await this.actionRepository.find({
            where: {
                state: ActionState.PROCESSING,
                worker: { identifier: name },
            },
            relations: ['mission', 'mission.project'],
        });
        logger.info(
            `Checking ${actionsInLocalProcess.length.toString()} pending Actions.`,
        );

        for (const action of actionsInLocalProcess) {
            if (!actionIds.has(action.uuid)) {
                logger.info(
                    `Action ${action.uuid} is running but has no running container.`,
                );
                await this.actionRepository.update(
                    { uuid: action.uuid },
                    {
                        state: ActionState.FAILED,
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        state_cause: 'Container crashed, no container found',
                    },
                );
            }
        }

        //////////////////////////////////////////////////////////////////////////////
        // Kill Old Containers
        //////////////////////////////////////////////////////////////////////////////

        // Fetch all known runners from DB to identify "Friendly" instances
        const knownRunners = await this.actionRunnerRepository.find({
            select: ['uuid'],
        });
        const knownInstanceIds = new Set(knownRunners.map((r) => r.uuid));

        for (const container of runningActionContainers) {
            const containerName = container.Names[0];

            if (!containerName) {
                continue;
            }

            const { instanceId, actionUuid } =
                this.parseContainerName(containerName);

            // 1. If it's MY container: Check standard cleanup rules (e.g. 24h limit)
            // 2. If it's a KNOWN runner (but not me): Kill it (Old instance of THIS env)
            // 3. Otherwise (Unknown runner or Legacy): IGNORE to prevent "Friendly Fire" on neighbor environments

            if (instanceId === this.currentInstanceId) {
                // My container. Check 24h limit.
                const action = await this.actionRepository.findOne({
                    where: { uuid: actionUuid },
                });
                if (!action) continue;

                await this.checkAndKillIfOld(container, action);
                continue;
            }

            if (instanceId && knownInstanceIds.has(instanceId)) {
                // It belongs to a runner in my DB (so it is my environment), but it is NOT this runner.
                // It is an OLD runner of THIS environment. KILL IT.
                logger.info(
                    `Container ${container.Id} belongs to old runner ${instanceId}, killing it.`,
                );
                await this.containerDaemon.killAndRemoveContainer(container.Id);

                // Mark action as failed
                await this.actionRepository.update(
                    { uuid: actionUuid },
                    {
                        state: ActionState.FAILED,
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        state_cause: 'Interrupted by new Runner Instance',
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        exit_code: 137,
                    },
                );
                continue;
            }

            // - instanceId is defined but NOT in DB (Neighbor Environment) -> IGNORE.
            // - instanceId is null (Legacy container) -> IGNORE (Safety first).

            if (instanceId) {
                logger.debug(
                    `Ignoring container ${container.Id} from unknown runner ${instanceId} (likely other environment).`,
                );
            } else {
                logger.debug(
                    `Ignoring legacy container ${container.Id} (no instance ID).`,
                );
            }
        }
    }

    private async checkAndKillIfOld(
        container: Dockerode.ContainerInfo,
        action: ActionEntity,
    ): Promise<void> {
        // ignore containers which are not in processing state
        if (
            action.state === ActionState.PROCESSING ||
            action.state === ActionState.STOPPING
        ) {
            // kill if older than 24 hours
            const createdAt = new Date(container.Created * 1000);
            const now = new Date();
            const diff = now.getTime() - createdAt.getTime();

            if (diff > 1000 * 60 * 60 * 24) {
                logger.info(
                    `Container for action ${action.uuid} is older than 24 hours, killing it.`,
                );
                await this.containerDaemon.killAndRemoveContainer(container.Id);

                await this.actionRepository.update(
                    { uuid: action.uuid },
                    {
                        state: ActionState.FAILED,

                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        state_cause:
                            'Container killed: running for more than 24 hours',
                    },
                );
            }
            return;
        }

        // kill and fail the action
        logger.info(
            `Container for completed action ${action.uuid} found, killing it.`,
        );

        await this.containerDaemon.killAndRemoveContainer(container.Id);

        if (action.state === ActionState.PENDING) {
            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    state: ActionState.FAILED,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    state_cause: 'Container killed: action has never started',
                },
            );
        }
    }

    private parseContainerName(containerName: string): {
        instanceId: string | null;
        actionUuid: string;
    } {
        const suffix = containerName.replace(
            `/${DockerDaemon.CONTAINER_PREFIX}`,
            '',
        );
        let instanceId: string | null = null;
        let actionUuid = suffix;

        // Check format: <InstanceUUID>-<ActionUUID>
        // UUID is 36 chars.
        if (suffix.length > 37 && suffix[36] === '-') {
            const potentialInstanceId = suffix.slice(0, 36);
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (uuidRegex.test(potentialInstanceId)) {
                instanceId = potentialInstanceId;
                actionUuid = suffix.slice(37);
            } else {
                logger.warn(
                    `Failed to parse instance UUID from container name: ${containerName}. Potential UUID '${potentialInstanceId}' is invalid.`,
                );
            }
        }

        return { instanceId, actionUuid };
    }
}
