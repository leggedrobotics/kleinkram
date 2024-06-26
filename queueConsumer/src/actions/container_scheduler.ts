import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../tracing';
import logger, { ACTION_CONTAINER_LABEL } from '../logger';
import { ContainerLog } from '@common/entities/action/action.entity';

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
}

const defaultContainerLimitations: ContainerLimits = {
    max_runtime: 10_000,
    memory_limit: 1073741824, // memory limit in bytes
    cpu_limit: 1000000000, // CPU limit in nano CPUs
    disk_quota: 10737418240,
};

export type ContainerEnv = {
    [key: string]: string;
}

export type ContainerOptions = {
    docker_image: string; // the docker image to run
    uuid: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    environment?: ContainerEnv;
}


export class ContainerScheduler {

    protected readonly docker: Docker;

    constructor() {
        this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
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
    protected async start_container(container_options?: Partial<ContainerOptions>): Promise<Dockerode.Container> {

        // merge the given container limitations with the default ones
        if (!container_options) container_options = {};
        container_options = {
            ...defaultContainerLimitations,
            ...container_options,
            limits: { ...defaultContainerLimitations, ...container_options?.limits },
            environment: { ...container_options?.environment },
        };

        logger.debug(`Starting container with options: ${JSON.stringify(container_options)}`);

        // assert that we only run rslethz images
        // TODO: uncomment this line when we have our own images
        // if (!docker_image.startsWith('rslethz/')) {
        //    throw new Error('Only images from the rslethz organization are allowed');
        // }

        // check if docker socket is available
        if (!this.docker || !await this.docker.ping()) {
            throw new Error('Docker socket not available or not responding');
        }

        const err_msg = await this.pull_image(container_options.docker_image)
            .catch(
                (error) => {

                    // cleanup error message
                    error.message = error.message.replace(/\(.*?\)/g, '');
                    error.message = error.message.replace(/ +/g, ' ').trim();

                    logger.warn(`Failed to pull image: ${error.message}`);
                    return error.message;
                },
            );

        logger.info('Creating container...');
        const container = await this.docker.createContainer({
            Image: container_options.docker_image,
            name: 'datasets-runner-' + container_options.uuid,
            Env: Object.entries(container_options.environment).map(([key, value]) => `${key}=${value}`),
            HostConfig: {
                Memory: container_options.limits.memory_limit, // memory limit in bytes
                NanoCpus: container_options.limits.cpu_limit, // CPU limit in nano CPUs
                DiskQuota: container_options.limits.disk_quota,
            },
        }).catch((error) => {

            // cleanup error message
            error.message = error.message.replace(/\(.*?\)/g, '');
            error.message = error.message.replace(/ +/g, ' ').trim();

            if (!!err_msg && err_msg !== '')
                throw new Error(`Failed to create container: ${error.message} due to image pull error: ${err_msg}`);

            logger.error(`Failed to create container: ${error.message}`);
            throw error;
        });

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        // TODO: check if there is a better solution which not used setTimeout
        setTimeout(async () => {

            if (!container || !await container.inspect().catch(() => false)) {
                throw new Error(`Container ${container.id} not found, cannot stop it.`);
            }

            if (!(await container.inspect()).State.Running) {
                logger.debug(`Container ${container.id} already stopped - no action required.`);
                return;
            }

            await container.stop();
            logger.info(`Runtime limit reached. Stopping container ${container.id}...`);

            // wait for max 10 seconds for the container to stop,
            // otherwise kill it
            setTimeout(async () => {
                if ((await container.inspect()).State.Running) {
                    await container.kill();
                    logger.info(`Container ${container.id} killed after reaching runtime limit.`);
                }
            }, 10_000);

        }, container_options.limits.max_runtime);

        container.wait().then(() => {
            logger.info(`Container ${container.id} stopped.`);
        });

        return container;
    }

    @tracing()
    private async pull_image(docker_image: string): Promise<void> {

        if (!this.docker || !await this.docker.ping()) {
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
     * Get logs from running or stopped container and return the logs as an array of objects.
     * Each object contains the timestamp, message, and type of the log (stdout or stderr).
     *
     * If the container is still running, the function will not return until the container stops.
     *
     * @param container - The container to get logs from
     * @param sanitize_callback - A callback function to sanitize the log messages
     *
     */
    @tracing()
    protected async getContainerLogs(
        container: Docker.Container,
        sanitize_callback?: (str: string) => string,
    ): Promise<ContainerLog[]> {
        const logs: ContainerLog[] = [];

        const container_logger = logger.child({
            labels: {
                container_id: container.id,
                job: ACTION_CONTAINER_LABEL,
            },
        });

        return new Promise(async (resolve, reject) => {
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: true,
            });

            stream.on('data', (chunk: Buffer) => {
                const logLines = chunk.toString().split('\n');
                logLines.forEach((line) => {
                    if (line.trim() !== '') {
                        const timestamp = line.split(' ')[0].split('+')[1];
                        let message = line.split(' ').slice(1).join(' ');

                        if (sanitize_callback) {
                            message = sanitize_callback(message);
                        }

                        logger.silly(message, { container_id: container.id });
                        container_logger.info(message);

                        logs.push({
                            timestamp: timestamp,
                            message: message,
                            type: line.startsWith('[stderr]')
                                ? 'stderr'
                                : 'stdout',
                        });
                    }
                });
            });

            stream.on('end', () => {
                resolve(logs);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }

}