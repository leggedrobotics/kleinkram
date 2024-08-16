import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../tracing';
import logger from '../logger';
import Action, { ContainerLog } from '@common/entities/action/action.entity';
import { ActionState } from '@common/enum';
import { Repository } from 'typeorm';

export type ContainerLimits = {
    /**
     * The maximum runtime of the container in milliseconds.
     */
    max_runtime: number;
    /**
     * The maximum memory the container can use in bytes.
     */
    memory_limit: number;
    /**
     * The maximum CPU the container can use in nano CPUs.
     */
    cpu_limit: number;
    /**
     * The maximum disk space the container can use in bytes.
     */
    disk_quota: number;
};

const defaultContainerLimitations: ContainerLimits = {
    max_runtime: 3600_000, // 1 hour
    memory_limit: 1073741824, // memory limit in bytes
    cpu_limit: 1000000000, // CPU limit in nano CPUs
    disk_quota: 10737418240,
};

export type ContainerEnv = {
    [key: string]: string;
};

export type ContainerOptions = {
    docker_image: string; // the docker image to run
    uuid: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    needs_gpu?: boolean;
    environment?: ContainerEnv;
};

export const dockerDaemonErrorHandler = (error: Error) => {
    logger.error(error.message);
    return null;
};

export class ContainerScheduler {
    protected readonly docker: Docker;
    protected static readonly CONTAINER_PREFIX = 'datasets-runner-';
    protected actionRepository: Repository<Action>;

    constructor(actionRepository: Repository<Action>) {
        this.actionRepository = actionRepository;
        this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }

    protected async onModuleInit() {
        // cleanup containers every 5 minutes
        await this.cleanupContainers();
        setInterval(async () => await this.cleanupContainers(), 1000 * 60 * 5);
    }

    /**
     * Start a container with the given action and uuid.
     *
     * The container will be stopped after max_runtime milliseconds and
     * forcefully killed 10 seconds after max_runtime if it is still running.
     *
     * This function returns as soon as the container is started.
     *
     * @private
     * @param container_options
     * @returns the container object
     * @throws Error if the docker image is not from the rslethz organization
     *
     */
    @tracing()
    protected async start_container(
        container_options?: Partial<ContainerOptions>,
    ): Promise<Dockerode.Container> {
        // merge the given container limitations with the default ones
        if (!container_options) container_options = {};
        container_options = {
            ...container_options,
            limits: {
                ...defaultContainerLimitations,
                ...container_options?.limits,
            },
            environment: { ...container_options?.environment },
        };

        logger.debug(
            `Starting container with options: ${JSON.stringify(container_options)}`,
        );

        // assert that we only run rslethz images
        if (!container_options.docker_image.startsWith('rslethz/')) {
            throw new Error(
                'Only images from the rslethz organization are allowed',
            );
        }

        // check if docker socket is available
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        const err_msg = await this.pull_image(
            container_options.docker_image,
        ).catch((error) => {
            // cleanup error message
            error.message = error.message.replace(/\(.*?\)/g, '');
            error.message = error.message.replace(/ +/g, ' ').trim();

            logger.warn(`Failed to pull image: ${error.message}`);
            return error.message;
        });

        const needs_gpu = container_options.needs_gpu || false;
        const add_gpu_capabilities = {
            DeviceRequests: [
                {
                    Driver: 'nvidia',
                    Count: 1,
                    Capabilities: [['gpu']],
                },
            ],
        };

        logger.info(
            needs_gpu
                ? 'Creating container with GPU support'
                : 'Creating container without GPU support',
        );

        const container = await this.docker
            .createContainer({
                Image: container_options.docker_image,
                name:
                    ContainerScheduler.CONTAINER_PREFIX +
                    container_options.uuid,
                Env: Object.entries(container_options.environment).map(
                    ([key, value]) => `${key}=${value}`,
                ),

                HostConfig: {
                    ...(needs_gpu ? add_gpu_capabilities : {}),
                    Memory: container_options.limits.memory_limit, // memory limit in bytes
                    NanoCpus: container_options.limits.cpu_limit, // CPU limit in nano CPUs
                    DiskQuota: container_options.limits.disk_quota,
                    NetworkMode: 'host',
                    // drop unnecessary default capabilities
                    CapDrop: [
                        'CHOWN',
                        'DAC_OVERRIDE',
                        'FSETID',
                        'FOWNER',
                        'MKNOD',
                        'NET_RAW',
                        'SETGID',
                        'SETUID',
                        'SETFCAP',
                        'SETPCAP',
                        'NET_BIND_SERVICE',
                        'SYS_CHROOT',
                        'KILL',
                        'AUDIT_WRITE',
                    ],

                    SecurityOpt: ['no-new-privileges'],

                    // limits the number of processes the container can create
                    // this helps to prevent fork bombs / bugs in the container
                    // and helps to keep the base system stable even if the container is compromised
                    PidsLimit: 256,
                },
            })
            .catch((error) => {
                // cleanup error message
                error.message = error.message.replace(/\(.*?\)/g, '');
                error.message = error.message.replace(/ +/g, ' ').trim();

                if (!!err_msg && err_msg !== '')
                    throw new Error(
                        `Failed to create container: ${error.message} due to image pull error: ${err_msg}`,
                    );

                logger.error(`Failed to create container: ${error.message}`);
                throw error;
            });

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        // TODO: check if there is a better solution which not used setTimeout
        setTimeout(async () => {
            if (
                !container ||
                !(await container.inspect().catch(dockerDaemonErrorHandler))
            ) {
                throw new Error(
                    `Container ${container.id} not found, cannot stop it.`,
                );
            }

            if (
                !(await container.inspect().catch(dockerDaemonErrorHandler))
                    ?.State.Running
            ) {
                logger.debug(
                    `Container ${container.id} already stopped - no action required.`,
                );
                return;
            }

            await container.stop().catch(dockerDaemonErrorHandler);
            logger.info(
                `Runtime limit reached. Stopping container ${container.id}...`,
            );

            // wait for max 10 seconds for the container to stop,
            // otherwise kill it
            setTimeout(async () => {
                if (
                    (await container.inspect().catch(dockerDaemonErrorHandler))
                        ?.State.Running
                ) {
                    await container.kill().catch(dockerDaemonErrorHandler);
                    logger.info(
                        `Container ${container.id} killed after reaching runtime limit.`,
                    );
                }
            }, 10_000);

            // remove the container after stopping
            await container.remove().catch(dockerDaemonErrorHandler);
        }, container_options.limits.max_runtime);

        container.wait().then(() => {
            logger.info(`Container ${container.id} stopped.`);
        });

        return container;
    }

    @tracing()
    private async pull_image(docker_image: string): Promise<void> {
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        if (!docker_image || docker_image === '') {
            throw new Error('No docker image specified');
        }

        logger.info(`Pulling image ${docker_image}`);
        const pullStream = await this.docker.pull(docker_image);
        await new Promise((res) =>
            this.docker.modem.followProgress(pullStream, res),
        );
        logger.info('Image pulled!');
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    protected async cleanupContainers() {
        logger.debug('Cleanup containers and dangling actions...');

        const running_action_containers: Dockerode.ContainerInfo[] =
            (
                await this.docker
                    .listContainers({ all: true })
                    .catch(dockerDaemonErrorHandler)
            )?.filter((container: Dockerode.ContainerInfo) =>
                container.Names[0].startsWith(
                    `/${ContainerScheduler.CONTAINER_PREFIX}`,
                ),
            ) || [];

        //////////////////////////////////////////////////////////////////////////////
        // Find crashed containers
        //////////////////////////////////////////////////////////////////////////////

        const action_ids = running_action_containers.map((container) =>
            container.Names[0].replace(
                `/${ContainerScheduler.CONTAINER_PREFIX}_`,
                '',
            ),
        );

        const actions_in_process = await this.actionRepository.find({
            where: { state: ActionState.PROCESSING },
            relations: ['mission', 'mission.project'],
        });
        logger.info(`Checking ${actions_in_process.length} pending Actions.`);

        for (const action of actions_in_process) {
            if (!action_ids.includes(action.docker_image)) {
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
            const action = await this.actionRepository.findOne({
                where: {
                    uuid: container.Names[0].replace(
                        `/${ContainerScheduler.CONTAINER_PREFIX}`,
                        '',
                    ),
                },
            });

            // kill action container if no corresponding action is found
            if (!action) {
                logger.warn(
                    `Container ${container.Id} has no corresponding action, killing it.`,
                );
                await this.killAndRemoveContainer(container.Id);
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
                    await this.killAndRemoveContainer(container.Id);

                    action.state = ActionState.FAILED;
                    action.state_cause =
                        'Container killed: running for more than 24 hours';
                    await this.actionRepository.save(action);
                }
            }

            // kill and fail the action
            logger.info(
                `Container for completed action ${action.uuid} found, killing it.`,
            );

            await this.killAndRemoveContainer(container.Id);

            if (action.state === ActionState.PENDING) {
                action.state = ActionState.FAILED;
                action.state_cause =
                    'Container killed: action has never started';
                await this.actionRepository.save(action);
            }
        }
    }

    private async killAndRemoveContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .kill()
            .catch(dockerDaemonErrorHandler);
        await this.docker
            .getContainer(container_id)
            .remove({ v: true })
            .catch(dockerDaemonErrorHandler);
    }

    private parseContainerLogLine(
        line: string,
        sanitize_callback?: (str: string) => string,
    ): ContainerLog {
        // remove all non-printable characters
        line = line.replace(/[\x00-\x1F\x7F]/u, '');

        const date_start_idx = line.indexOf('20');
        let date_end_idx = line.indexOf(' ', date_start_idx);
        date_end_idx = date_end_idx === -1 ? line.length : date_end_idx;

        const date_str = line.substring(date_start_idx, date_end_idx);
        const timestamp = new Date(date_str).toISOString();

        let message = line.substring(date_end_idx);
        if (sanitize_callback && message != '') {
            message = sanitize_callback(message);
        }

        return {
            timestamp: timestamp,
            message: message,
            type: line.startsWith('[stderr]') ? 'stderr' : 'stdout',
        };
    }

    /**
     * Get logs from running or stopped container and return the logs as an array of objects.
     * Each object contains the timestamp, message, and type of the log (stdout or stderr).
     *
     * If the container is still running, the function will not return until the container stops.
     *
     * @param container - The container to get logs from
     * @param action - The action object to attach the logs to
     * @param sanitize_callback - A callback function to sanitize the log messages
     * @param liveStreaming - If true, the logs will be saved regularly during the extraction
     *
     */
    @tracing()
    protected async getContainerLogs(
        container: Dockerode.Container,
        action: Action,
        sanitize_callback?: (str: string) => string,
        liveStreaming: boolean = true,
    ): Promise<ContainerLog[]> {
        const logs: ContainerLog[] = [];

        const container_logger = logger.child({
            labels: {
                container_id: container.id,
                action_uuid: action?.uuid || 'unknown',
                mission_uuid: action?.mission?.uuid || 'unknown',
                project_uuid: action?.mission?.project?.uuid || 'unknown',
            },
        });

        return new Promise(async (resolve, reject) => {
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: true,
            });

            // if enabled, we save the logs regularly during the extraction
            // this allows to stream logs of running containers in "realtime"
            // to the user
            let intervalLogSever = null;
            if (liveStreaming) {
                intervalLogSever = setInterval(async () => {
                    action.logs = logs;
                    await this.actionRepository.save(action);
                }, 1_000);
            }

            stream.on('data', (chunk: Buffer) => {
                chunk
                    .toString()
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line !== '')
                    .forEach((line) => {
                        try {
                            const log_entry = this.parseContainerLogLine(
                                line,
                                sanitize_callback,
                            );

                            logs.push(log_entry);
                            logger.silly(log_entry.message, {
                                container_id: container.id,
                            });
                            container_logger.info(
                                `[${log_entry.timestamp}] ${log_entry.message}`,
                            );
                        } catch {
                            logger.error(`Failed to parse log line: '${line}'`);
                        }
                    });
            });

            stream.on('end', () => {
                intervalLogSever?.unref();
                resolve(logs);
            });

            stream.on('error', (error) => {
                intervalLogSever?.unref();
                reject(error);
            });
        });
    }
}
