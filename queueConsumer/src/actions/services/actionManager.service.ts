import { Injectable } from '@nestjs/common';
import {
    ContainerEnv,
    DockerDaemon,
    dockerDaemonErrorHandler,
} from './dockerDaemon.service';
import { tracing } from '../../tracing';
import logger from '../../logger';
import {
    AccessGroupRights,
    ActionState,
    ArtifactState,
    KeyTypes,
} from '@common/enum';
import { InjectRepository } from '@nestjs/typeorm';
import Action, { ContainerLog } from '@common/entities/action/action.entity';
import { Repository } from 'typeorm';
import Apikey from '@common/entities/auth/apikey.entity';
import Dockerode from 'dockerode';
import { DisposableAPIKey } from '../helper/disposableAPIKey';
import { bufferTime, concatMap, lastValueFrom, Observable, tap } from 'rxjs';
import env from '@common/env';

@Injectable()
export class ActionManagerService {
    // we will write logs to the database every 1 second
    private static LOG_WRITE_BATCH_TIME = 1_000;

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
            rights: AccessGroupRights.WRITE, // todo read from frontend
            key_type: KeyTypes.CONTAINER,
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

        // set state to 'RUNNING'
        action.state = ActionState.PROCESSING;
        action.state_cause = 'Action is currently running...';
        await this.actionRepository.save(action);

        using apikey = await this.createAPIkey(action);

        const env_variables: ContainerEnv = {
            APIKEY: apikey.apikey,
            PROJECT_UUID: action.mission.project.uuid,
            MISSION_UUID: action.mission.uuid,
            ACTION_UUID: action.uuid,
            ENDPOINT: env.ENDPOINT,
        };
        const needs_gpu =
            action.template.runtime_requirements.gpu_model !== null &&
            action.template.runtime_requirements.gpu_model.name !== 'no-gpu';
        const { container, repo_digests, sha } =
            await this.containerDaemon.start_container({
                docker_image: action.template.image_name,
                name: action.uuid,
                limits: {
                    max_runtime: 5 * 60 * 1_000, // 5 minutes
                    cpu_limit: 2 * 1000000000, // 2 CPU cores in nano cores
                    memory_limit: 2 * 1024 * 1024 * 1024, // 2 GB
                },
                needs_gpu,
                environment: env_variables,
                command: action.template.command,
            });

        // capture runner information
        action.image = { repo_digests, sha };
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

        await this.processContainerLogs(logsObservable, action, container.id);

        // wait for the container to stop
        await container.wait();
        await this.containerDaemon.removeContainer(container.id, false);
        await this.setActionState(container, action);
        action.executionEndedAt = new Date();
        action.artifacts = ArtifactState.UPLOADING;
        await this.actionRepository.save(action);

        const { container: artifact_upload_container, parentFolder } =
            await this.containerDaemon.launchArtifactUploadContainer(
                action.uuid,
                `${action.template.name}-v${action.template.version}-${action.uuid}`,
            );
        await artifact_upload_container.wait();
        action.artifacts = ArtifactState.UPLOADED;
        await this.containerDaemon.removeContainer(
            artifact_upload_container.id,
            true,
        );
        action.artifact_url = `https://drive.google.com/drive/folders/${parentFolder}`;
        await this.actionRepository.save(action);

        return true; // mark the job as completed
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
        const container_id = container.id;
        const container_details = await container
            .inspect()
            .catch(dockerDaemonErrorHandler);

        action.executionStartedAt = new Date(container_details.Created);
        action.container = {
            id: container_id,
        };
        action.runner_info = {
            hostname: container_details?.Config?.Hostname || 'N/A',
            runtime_capabilities: undefined,
        };
        action.logs = [];
    }

    /**
     * Process the logs from the container and save them to the database.
     * The logs are written to the database periodically to reduce the
     * number of writes.
     *
     * The logs are also written to the logger service tagged with the
     * container_id and action_uuid.
     *
     * @param logsObservable
     * @param action
     * @param container_id
     * @private
     */
    private async processContainerLogs(
        logsObservable: Observable<ContainerLog>,
        action: Action,
        container_id: string,
    ) {
        const container_logger = logger.child({
            labels: {
                container_id: container_id,
                action_uuid: action?.uuid || 'unknown',
            },
        });

        await lastValueFrom(
            logsObservable.pipe(
                tap((next) =>
                    container_logger.info(
                        `[${next.timestamp}] ${next.message}`,
                    ),
                ),
                bufferTime(ActionManagerService.LOG_WRITE_BATCH_TIME),
                concatMap(async (next_log_batch: ContainerLog[]) => {
                    action.logs.push(...next_log_batch);
                    await this.actionRepository.save(action);
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
        const container_details_after = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${container_details_after.State.ExitCode}`,
        );

        const exit_code = Number(container_details_after.State.ExitCode);

        if (exit_code === 125) {
            action.state = ActionState.FAILED;
            action.exit_code = exit_code;
            action.state_cause =
                'Container failed to run. The docker run command did ' +
                'not execute successfully. Please open an issue ' +
                'problem persists.';
            return;
        } else if (exit_code === 139) {
            action.state = ActionState.FAILED;
            action.exit_code = exit_code;
            action.state_cause =
                'Container was terminated by the operating system via SIGSEGV signal. ' +
                'This usually happens when the container tries to access memory ' +
                'it is not allowed to access.';
            return;
        } else if (exit_code === 143) {
            action.state = ActionState.FAILED;
            action.exit_code = exit_code;
            action.state_cause =
                'Container was terminated by the operating system via SIGTERM signal. ' +
                'This usually happens when the container is stopped due to approaching ' +
                'time limit.';
            return;
        } else if (exit_code === 137) {
            action.state = ActionState.FAILED;
            action.exit_code = exit_code;
            action.state_cause =
                'Container was immediately terminated by the operating ' +
                'system via SIGKILL signal. This usually happens when the ' +
                'container exceeds the memory limit or reaches the time CPU limit.';
            return;
        }

        action.state_cause = `Container exited with code ${exit_code}`;
        action.state = exit_code == 0 ? ActionState.DONE : ActionState.FAILED;
        action.exit_code = exit_code;
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    async cleanupContainers() {
        logger.debug('Cleanup containers and dangling actions...');

        const running_action_containers: Dockerode.ContainerInfo[] =
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

        const action_ids = running_action_containers.map((container) =>
            container.Names[0].replace(`/${DockerDaemon.CONTAINER_PREFIX}`, ''),
        );

        const actions_in_process = await this.actionRepository.find({
            where: { state: ActionState.PROCESSING },
            relations: ['mission', 'mission.project'],
        });
        logger.info(`Checking ${actions_in_process.length} pending Actions.`);

        for (const action of actions_in_process) {
            if (!action_ids.includes(action.uuid)) {
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
        for (const container of running_action_containers) {
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
            if (action?.state === ActionState.PROCESSING) {
                // kill if older than 24 hours
                const created_at = new Date(container.Created * 1000);
                const now = new Date();
                const diff = now.getTime() - created_at.getTime();

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
