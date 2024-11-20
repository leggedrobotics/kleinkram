import { Injectable } from '@nestjs/common';
import {
    ContainerEnv,
    DockerDaemon,
    dockerDaemonErrorHandler,
} from './dockerDaemon.service';
import { tracing } from '../../tracing';
import logger from '../../logger';
import {
    ActionState,
    ArtifactState,
    KeyTypes,
} from '@common/frontend_shared/enum';
import { InjectRepository } from '@nestjs/typeorm';
import Action, { ContainerLog } from '@common/entities/action/action.entity';
import { Repository } from 'typeorm';
import Apikey from '@common/entities/auth/apikey.entity';
import Dockerode from 'dockerode';
import { DisposableAPIKey } from '../helper/disposableAPIKey';
import { bufferTime, concatMap, lastValueFrom, Observable, tap } from 'rxjs';
import env from '@common/env';
import si from 'systeminformation';

@Injectable()
export class ActionManagerService {
    // we will write logs to the database every 100 millisecond
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
    async createAPIkey(action: Action) {
        const apiKey = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            rights: action.template.accessRights,
            // eslint-disable-next-line @typescript-eslint/naming-convention
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
    async processAction(action: Action) {
        logger.info(`\n\nProcessing Action ${action.uuid}`);

        logger.info('Creating container.');

        if (action.state !== ActionState.PENDING)
            throw new Error(`Action state is not 'PENDING'`);

        // set state to 'STARTING'
        action.state = ActionState.STARTING;
        action.state_cause = 'Action is currently running...';
        await this.actionRepository.save(action);

        const apikey = await this.createAPIkey(action);
        try {
            const envVariables: ContainerEnv = {
                /* eslint-disable @typescript-eslint/naming-convention */
                APIKEY: apikey.apikey,
                PROJECT_UUID: action.mission.project.uuid,
                MISSION_UUID: action.mission.uuid,
                ACTION_UUID: action.uuid,
                ENDPOINT: env.ENDPOINT,
                /* eslint-enable @typescript-eslint/naming-convention */
            };
            const needsGpu = action.template.gpuMemory > 0;
            const { container, repoDigests, sha } =
                await this.containerDaemon.startContainer(
                    async () => {
                        action.state = ActionState.PROCESSING;
                        await this.actionRepository.save(action);
                    },
                    {
                        /* eslint-disable @typescript-eslint/naming-convention */
                        docker_image: action.template.image_name,
                        name: action.uuid,
                        limits: {
                            max_runtime:
                                action.template.maxRuntime * 60 * 60 * 1_000, // Hours to milliseconds
                            n_cpu: action.template.cpuCores || 1,
                            memory_limit:
                                (action.template.cpuMemory || 2) *
                                1024 *
                                1024 *
                                1024, // min 2 GB
                        },
                        needs_gpu: needsGpu,
                        environment: envVariables,
                        command: action.template.command,
                        entrypoint: action.template.entrypoint,
                        /* eslint-enable @typescript-eslint/naming-convention */
                    },
                );

            // capture runner information
            action.image = { repoDigests: repoDigests, sha };
            await this.setContainerInfo(action, container);
            await this.actionRepository.save(action);

            const sanitize = (str: string) => {
                return str.replace(apikey.apikey, '***');
            };

            // get logs from container and save them to the database
            const logsObservable = await this.containerDaemon
                .subscribeToLogs(container.id, sanitize)
                .catch((err) => {
                    logger.error('Error while subscribing to logs:', err);
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

            await this.containerDaemon.removeContainer(container.id, true);
            await this.setActionState(container, action);
            action.executionEndedAt = new Date();
            action.artifacts = ArtifactState.UPLOADING;
            await this.actionRepository.save(action);

            const { container: artifactUploadContainer, parentFolder } =
                await this.containerDaemon.launchArtifactUploadContainer(
                    action.uuid,
                    `${action.template.name}-v${action.template.version}-${action.uuid}`,
                );
            await artifactUploadContainer.wait();
            action.artifacts = ArtifactState.UPLOADED;
            await this.containerDaemon.removeContainer(
                artifactUploadContainer.id,
            );
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
    ) {
        const containerId = container.id;
        const containerDetails = await container
            .inspect()
            .catch(dockerDaemonErrorHandler);

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
    ) {
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
                            const _action = await manager.findOneOrFail(
                                Action,
                                {
                                    where: { uuid: actionUuid },
                                },
                            );
                            _action.logs.push(...nextLogBatch);
                            await manager.save(_action);
                        },
                    );
                }),
            ),
        ).catch((err) => {
            logger.error('Error while processing logs:', err);
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
    ) {
        const containerDetailsAfter = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${containerDetailsAfter.State.ExitCode}`,
        );

        const exitCode = Number(containerDetailsAfter.State.ExitCode);

        if (exitCode === 125) {
            action.state = ActionState.FAILED;
            action.exit_code = exitCode;
            action.state_cause =
                'Container failed to run. The docker run command did ' +
                'not execute successfully. Please open an issue ' +
                'problem persists.';
        } else if (exitCode === 139) {
            action.state = ActionState.FAILED;
            action.exit_code = exitCode;
            action.state_cause =
                'Container was terminated by the operating system via SIGSEGV signal. ' +
                'This usually happens when the container tries to access memory ' +
                'it is not allowed to access.';
        } else if (exitCode === 143) {
            action.state = ActionState.FAILED;
            action.exit_code = exitCode;
            action.state_cause =
                'Container was terminated by the operating system via SIGTERM signal. ' +
                'This usually happens when the container is stopped due to approaching ' +
                'time limit.';
        } else if (exitCode === 137) {
            action.state = ActionState.FAILED;
            action.exit_code = exitCode;
            action.state_cause =
                'Container was immediately terminated by the operating ' +
                'system via SIGKILL signal. This usually happens when the ' +
                'container exceeds the memory limit or reaches the time CPU limit.';
        } else {
            action.state_cause = `Container exited with code ${exitCode}`;
            action.state =
                exitCode == 0 ? ActionState.DONE : ActionState.FAILED;
            action.exit_code = exitCode;
        }
        logger.warn(`Action ${action.uuid} has failed with exit code 125`);
        logger.warn(action.state_cause);
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    async cleanupContainers() {
        logger.debug('Cleanup containers and dangling actions...');

        const runningActionContainers: Dockerode.ContainerInfo[] =
            (
                await this.containerDaemon.docker
                    .listContainers({ all: true })
                    .catch(dockerDaemonErrorHandler)
            )?.filter((container: Dockerode.ContainerInfo) =>
                container.Names[0].startsWith(
                    `/${DockerDaemon.CONTAINER_PREFIX}`,
                ),
            ) || [];
        //////////////////////////////////////////////////////////////////////////////
        // Find crashed containers
        //////////////////////////////////////////////////////////////////////////////

        const actionIds = runningActionContainers.map((container) =>
            container.Names[0].replace(`/${DockerDaemon.CONTAINER_PREFIX}`, ''),
        );
        const name = (await si.osInfo()).hostname;
        const actionsInLocalProcess = await this.actionRepository.find({
            where: {
                state: ActionState.PROCESSING,
                worker: { identifier: name },
            },
            relations: ['mission', 'mission.project'],
        });
        logger.info(
            `Checking ${actionsInLocalProcess.length} pending Actions.`,
        );

        for (const action of actionsInLocalProcess) {
            if (!actionIds.includes(action.uuid)) {
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
            const uuid = container.Names[0].replace(
                `/${DockerDaemon.CONTAINER_PREFIX}`,
                '',
            );
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
