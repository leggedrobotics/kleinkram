import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../tracing';
import logger from '../logger';
import { ContainerLog } from '@common/entities/action/action.entity';

export type ContainerLimitations = {
    max_runtime: number;
    memory_limit: number;
    cpu_limit: number;
    disk_quota: number;
}

export const defaultContainerLimitations: ContainerLimitations = {
    max_runtime: 10_000,
    memory_limit: 1073741824, // memory limit in bytes
    cpu_limit: 1000000000, // CPU limit in nano CPUs
    disk_quota: 10737418240,
};

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
     * @param docker_image - the docker image to run
     * @param uuid - a unique identifier for the container
     * @param container_limitations
     * @private
     *
     * @returns the container object
     *
     * @throws Error if the docker image is not from the rslethz organization
     *
     */
    @tracing()
    protected async start_container(
        docker_image: string,
        uuid: string,
        container_limitations?: Partial<ContainerLimitations>,
    ): Promise<Dockerode.Container> {

        // merge the given container limitations with the default ones
        if (!container_limitations) container_limitations = {};
        container_limitations = { ...defaultContainerLimitations, ...container_limitations };

        // assert that we only run rslethz images
        // TODO: uncomment this line when we have our own images
        // if (!docker_image.startsWith('rslethz/')) {
        //    throw new Error('Only images from the rslethz organization are allowed');
        // }

        // check if docker socket is available
        if (!this.docker || !await this.docker.ping()) {
            throw new Error('Docker socket not available or not responding');
        }

        await this.pull_image(docker_image);

        logger.info('Creating container...');
        const container = await this.docker.createContainer({
            Image: docker_image,
            name: 'datasets-runner-' + uuid,
            Cmd: [
                '/bin/sh',
                '-c',
                'while true; do echo hello world; sleep 1; done',
            ],
            HostConfig: {
                Memory: container_limitations.memory_limit, // memory limit in bytes
                NanoCpus: container_limitations.cpu_limit, // CPU limit in nano CPUs
                DiskQuota: container_limitations.disk_quota,
            },
        });

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        setTimeout(async () => {
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

        }, container_limitations.max_runtime);

        container.wait().then(() => {
            logger.info(`Container ${container.id} stopped.`);
        });

        return container;
    }

    @tracing()
    private async pull_image(docker_image: string): Promise<void> {
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
     *
     */
    @tracing()
    protected async getContainerLogs(
        container: Docker.Container,
    ): Promise<ContainerLog[]> {
        const logs: ContainerLog[] = [];

        const container_logger = logger.child({
            labels: {
                container_id: container.id,
                job: 'action_container',
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
                        const message = line.split(' ').slice(1).join(' ');

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