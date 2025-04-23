import Action, { ContainerLog } from '@common/entities/action/action.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import environment from '@common/environment';
import {
    ActionState,
    ArtifactState,
    KeyTypes,
} from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Dockerode from 'dockerode';
import { bufferTime, concatMap, lastValueFrom, Observable, tap } from 'rxjs';
import si from 'systeminformation';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { tracing } from '../../tracing';
import { DisposableAPIKey } from '../helper/disposable-api-key';
import {
    ContainerEnvironment,
    DockerDaemon,
    dockerDaemonErrorHandler,
} from './docker-daemon.service';

@Injectable()
export class ActionManagerService {
    // we will write logs to the database every 100 millisecond

    private static LOG_WRITE_BATCH_TIME = 100;

    constructor(
        private containerDaemon: DockerDaemon,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
    ) {}

    /**
     * Creates a new API key for the given action.
     * The API key is used to authenticate the action container.
     *
     * The API key is automatically deleted when the action is completed.
     *
     * @param action
     */
    @tracing('create_apikey')
    async createAPIkey(action: Action): Promise<DisposableAPIKey> {
        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }

        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }

        if (action.createdBy === undefined) {
            throw new Error('User is undefined');
        }

        const apiKey = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            rights: action.template.accessRights,
            key_type: KeyTypes.CONTAINER,
            action: action,
            user: action.createdBy,
        });
        return new DisposableAPIKey(
            await this.apikeyRepository.save(apiKey),
            this.apikeyRepository,
        );
    }

    @tracing('processing_action')
    async processAction(action: Action): Promise<boolean> {
        logger.info(`\n\nProcessing Action ${action.uuid}`);

        logger.info('Creating container.');

        if (action.state !== ActionState.PENDING)
            throw new Error(`Action state is not 'PENDING'`);

        // set state to 'STARTING'
        action.state = ActionState.STARTING;
        action.state_cause = 'Action is currently running...';
        await this.actionRepository.save(action);

        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }
        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }
        if (action.createdBy === undefined) {
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
                KLEINKRAM_API_ENDPOINT: environment.ENDPOINT,
                KLEINKRAM_S3_ENDPOINT: `https://${environment.MINIO_ENDPOINT}${environment.DEV ? ':9000' : ''}`,

                // @deprecated
                // TODO: the following variables are deprecated
                APIKEY: apikey.apikey,
                PROJECT_UUID: action.mission.project.uuid,
                MISSION_UUID: action.mission.uuid,
                ACTION_UUID: action.uuid,
                ENDPOINT: environment.ENDPOINT,
            };
            const needsGpu = action.template.gpuMemory > 0;
            const { container, repoDigests, sha } =
                await this.containerDaemon.startContainer(
                    async () => {
                        action.state = ActionState.PROCESSING;
                        await this.actionRepository.save(action);
                    },
                    {
                        docker_image: action.template.image_name,
                        name: action.uuid,
                        limits: {
                            max_runtime:
                                action.template.maxRuntime * 60 * 60 * 1000, // Hours to milliseconds
                            n_cpu: action.template.cpuCores || 1,
                            memory_limit:
                                (action.template.cpuMemory || 2) *
                                1024 *
                                1024 *
                                1024, // min 2 GB
                        },
                        needs_gpu: needsGpu,
                        environment: environmentVariables ?? '',
                        command: action.template.command ?? '',
                        entrypoint: action.template.entrypoint ?? '',
                    },
                );

            // capture runner information
            action.image = { repoDigests: repoDigests, sha };
            await this.setContainerInfo(action, container);
            await this.actionRepository.save(action);

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

            action.state = ActionState.STOPPING;
            await this.actionRepository.save(action);

            this.containerDaemon.removeContainer(container.id, true);
            await this.setActionState(container, action);
            action.executionEndedAt = new Date();
            action.artifacts = ArtifactState.UPLOADING;
            await this.actionRepository.save(action);

            if (action.template === undefined) {
                throw new Error('Template is undefined');
            }

            const { container: artifactUploadContainer, parentFolder } =
                await this.containerDaemon.launchArtifactUploadContainer(
                    action.uuid,
                    `${action.template.name}-v${action.template.version.toString()}-${action.uuid}`,
                );
            await artifactUploadContainer.wait();
            action.artifacts = ArtifactState.UPLOADED;
            this.containerDaemon.removeContainer(artifactUploadContainer.id);
            await this.containerDaemon.removeVolume(action.uuid);
            action.artifact_url = `https://drive.google.com/drive/folders/${parentFolder}`;
            await this.actionRepository.save(action);

            return true; // Mark the job as completed
        } finally {
            await apikey[Symbol.asyncDispose]();
        }
    }

    /**
     * Inspects the container and sets the container information to the action
     * object. This function does not save the action to the database!
     *
     * @param action
     * @param container
     * @private
     */
    private async setContainerInfo(
        action: Action,
        container: Dockerode.Container,
    ): Promise<void> {
        const containerId = container.id;
        const containerDetails = await container.inspect();

        action.executionStartedAt = new Date(containerDetails.Created);
        action.container = {
            id: containerId,
        };
        action.logs = [];
    }

    /**
     * Process the logs from the container and save them to the database.
     * The logs are written to the database periodically to reduce the
     * number of writes.
     *
     * The logs are also written to the logger service tagged with the
     * containerId and actionUuid.
     *
     * @param logsObservable
     * @param actionUuid
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
                container_id: containerId,
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
                            const _action = await manager.findOneOrFail(
                                Action,
                                {
                                    where: { uuid: actionUuid },
                                },
                            );

                            if (_action.logs === undefined) {
                                _action.logs = [];
                            }

                            _action.logs.push(...nextLogBatch);
                            await manager.save(_action);
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
     */
    private async setActionState(
        container: Dockerode.Container,
        action: Action,
    ): Promise<void> {
        const containerDetailsAfter = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${containerDetailsAfter.State.ExitCode.toString()}`,
        );

        const exitCode = Number(containerDetailsAfter.State.ExitCode);

        switch (exitCode) {
            case 125: {
                action.state = ActionState.FAILED;
                action.exit_code = exitCode;
                action.state_cause =
                    'Container failed to run. The docker run command did ' +
                    'not execute successfully. Please open an issue ' +
                    'problem persists.';

                break;
            }
            case 139: {
                action.state = ActionState.FAILED;
                action.exit_code = exitCode;
                action.state_cause =
                    'Container was terminated by the operating system via SIGSEGV signal. ' +
                    'This usually happens when the container tries to access memory ' +
                    'it is not allowed to access.';

                break;
            }
            case 143: {
                action.state = ActionState.FAILED;
                action.exit_code = exitCode;
                action.state_cause =
                    'Container was terminated by the operating system via SIGTERM signal. ' +
                    'This usually happens when the container is stopped due to approaching ' +
                    'time limit.';

                break;
            }
            case 137: {
                action.state = ActionState.FAILED;
                action.exit_code = exitCode;
                action.state_cause =
                    'Container was immediately terminated by the operating ' +
                    'system via SIGKILL signal. This usually happens when the ' +
                    'container exceeds the memory limit or reaches the time CPU limit.';

                break;
            }
            default: {
                action.state_cause = `Container exited with code ${exitCode.toString()}`;
                action.state =
                    exitCode === 0 ? ActionState.DONE : ActionState.FAILED;
                action.exit_code = exitCode;
            }
        }
        logger.warn(`Action ${action.uuid} has failed with exit code 125`);
        logger.warn(action.state_cause);
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    async cleanupContainers(): Promise<void> {
        logger.debug('Cleanup containers and dangling actions...');

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
            runningActionContainers.map((container) =>
                container.Names[0]?.replace(
                    `/${DockerDaemon.CONTAINER_PREFIX}`,
                    '',
                ),
            ),
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
                action.state = ActionState.FAILED;
                action.state_cause = 'Container crashed, no container found';
                await this.actionRepository.save(action);
            }
        }

        //////////////////////////////////////////////////////////////////////////////
        // Kill Old Containers
        //////////////////////////////////////////////////////////////////////////////
        for (const container of runningActionContainers) {
            // try to find corresponding action
            const uuid = container.Names[0]?.replace(
                `/${DockerDaemon.CONTAINER_PREFIX}`,
                '',
            );

            if (uuid === undefined) {
                logger.warn(
                    `Container ${container.Id} has no corresponding action, killing it.`,
                );
                await this.containerDaemon.killAndRemoveContainer(container.Id);
                continue;
            }

            const action = await this.actionRepository.findOne({
                where: {
                    uuid,
                },
            });

            // kill action container if no corresponding action is found
            if (!action) {
                logger.warn(
                    `Container ${container.Id} has no corresponding action, killing it.`,
                );
                await this.containerDaemon.killAndRemoveContainer(container.Id);
                continue;
            }
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
                    await this.containerDaemon.killAndRemoveContainer(
                        container.Id,
                    );

                    action.state = ActionState.FAILED;
                    action.state_cause =
                        'Container killed: running for more than 24 hours';
                    await this.actionRepository.save(action);
                }
                continue;
            }

            // kill and fail the action
            logger.info(
                `Container for completed action ${action.uuid} found, killing it.`,
            );

            await this.containerDaemon.killAndRemoveContainer(container.Id);

            if (action.state === ActionState.PENDING) {
                action.state = ActionState.FAILED;
                action.state_cause =
                    'Container killed: action has never started';
                await this.actionRepository.save(action);
            }
        }
    }
}
