import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../../tracing';
import logger from '../../logger';
import { ContainerLog } from '@common/entities/action/action.entity';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

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
    max_runtime: 60 * 60 * 1_000, // 1 hour
    memory_limit: 1024 * 1024 * 1024, // 1GB
    cpu_limit: 1000000000, // CPU limit in nano CPUs
    disk_quota: 10737418240,
};

export type ContainerEnv = {
    [key: string]: string;
};

export type ContainerStartOptions = {
    docker_image: string; // the docker image to run
    name: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    needs_gpu?: boolean;
    environment?: ContainerEnv;
};

export const dockerDaemonErrorHandler = (error: Error) => {
    logger.error(error.message);
    return null;
};

/**
 * The DockerDaemon class is responsible for managing the Docker daemon.
 * It provides methods to start, stop, and get logs from containers.
 *
 */
@Injectable()
export class DockerDaemon {
    readonly docker: Docker;
    static readonly CONTAINER_PREFIX = 'kleinkram-user-action-';

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
    async start_container(
        container_options?: Partial<ContainerStartOptions>,
    ): Promise<{
        container: Dockerode.Container;
        repo_digests: string[];
    }> {
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

        await this.pull_image(container_options.docker_image).catch((error) => {
            // cleanup error message
            error.message = error.message.replace(/\(.*?\)/g, '');
            error.message = error.message.replace(/ +/g, ' ').trim();

            logger.warn(`Failed to pull image: ${error.message}`);
        });

        // get image details
        const image = this.docker.getImage(container_options.docker_image);
        const image_details = await image
            .inspect()
            .catch(dockerDaemonErrorHandler);
        if (!image_details) {
            throw new Error(
                `Image ${container_options.docker_image} not found, could not start container!`,
            );
        }
        const repo_digests = image_details.RepoDigests;

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

        const container_create_options: Dockerode.ContainerCreateOptions = {
            Image: container_options.docker_image,
            name: DockerDaemon.CONTAINER_PREFIX + container_options.name,
            Env: Object.entries(container_options.environment).map(
                ([key, value]) => `${key}=${value}`,
            ),

            HostConfig: {
                ...(needs_gpu ? add_gpu_capabilities : {}),
                Memory: container_options.limits.memory_limit, // memory limit in bytes
                NanoCpus: container_options.limits.cpu_limit, // CPU limit in nano CPUs
                DiskQuota: container_options.limits.disk_quota,

                // TODO: we should not use host network mode
                //  as it can be a security risk! We should use a bridge network instead.
                NetworkMode: 'host',

                // As we are streaming the logs,
                // we need to keep the logs at a reasonable size.
                LogConfig: {
                    Type: 'json-file',
                    Config: {
                        'max-size': '10m',
                        'max-file': '1',
                    },
                },

                // For security reasons, we drop all default capabilities
                // and only add the ones we really need.
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

                // we don't want to allow the container to escalate privileges
                SecurityOpt: ['no-new-privileges'],

                // limits the number of processes the container can create
                // this helps to prevent fork bombs / bugs in the container
                // and helps to keep the base system stable even if the container is compromised
                PidsLimit: 256,
            },
        };

        const container = await this.docker
            .createContainer(container_create_options)
            .catch((error) => {
                // cleanup error message
                error.message = error.message.replace(/\(.*?\)/g, '');
                error.message = error.message.replace(/ +/g, ' ').trim();
                logger.error(`Failed to create container: ${error.message}`);
                throw error;
            });

        if (!container) {
            throw new Error('Failed to create container');
        }

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        this.killContainerAfterMaxRuntime(
            container,
            container_options.limits.max_runtime,
        );

        return { container, repo_digests };
    }

    /**
     * Kill a container after max_runtime_ms milliseconds.
     *
     * The OS sends a SIGTERM signal to the container, which allows the container to
     * gracefully shut down. If the container does not stop after 10 seconds, it is
     * forcefully killed (SIGKILL).
     *
     * @param container
     * @param max_runtime_ms
     * @private
     */
    private killContainerAfterMaxRuntime(
        container: Dockerode.Container,
        max_runtime_ms: number,
    ) {
        const cancel_timeout = setTimeout(async () => {
            logger.info(
                `Stopping container ${container.id} after ${max_runtime_ms}ms`,
            );

            // initialize a kill timeout
            const killTimout = setTimeout(async () => {
                logger.info(
                    `Killing container ${container.id} after 10 seconds of stopping`,
                );
                await this.killAndRemoveContainer(container.id);
            }, 10_000);

            await this.stopContainer(container.id);
            clearTimeout(killTimout); // clear the kill timeout
            await this.removeContainer(container.id);
        }, max_runtime_ms);

        container.wait().finally(() => {
            clearTimeout(cancel_timeout); // clear the cancel timeout
        });
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

    async stopContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .stop()
            .catch(dockerDaemonErrorHandler);
    }

    async killAndRemoveContainer(container_id: string) {
        await this.killContainer(container_id);
        await this.removeContainer(container_id);
    }

    async killContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .kill()
            .catch(dockerDaemonErrorHandler);
    }

    async removeContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .remove({ v: true })
            .catch(dockerDaemonErrorHandler);
    }

    /**
     * Parse a log line from a container.
     *
     * @param line
     * @param sanitize_callback
     * @private
     */
    private static parseContainerLogLine(
        line: string,
        sanitize_callback?: (str: string) => string,
    ): ContainerLog {
        const log_level = line.split('')[0].charCodeAt(0);

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
            type: log_level === 2 ? 'stderr' : 'stdout',
        };
    }

    /**
     * Subscribe to the logs of a container.
     * The logs are parsed and returned as an observable.
     *
     * @param container_id the id of the container
     * @param sanitize_callback a callback function to sanitize the log messages
     *                       before they are emitted (e.g. to remove sensitive information
     *                       like api keys)
     * @returns an observable that emits log entries
     */
    @tracing()
    async subscribeToLogs(
        container_id: string,
        sanitize_callback?: (str: string) => string,
    ) {
        const container = this.docker.getContainer(container_id);

        const dockerodeLogStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            details: true,
            timestamps: true,
        });

        return new Observable<ContainerLog>((observer) => {
            dockerodeLogStream.on('data', (chunk) => {
                chunk
                    .toString()
                    .split('\n')
                    .filter((line) => line !== '')
                    .map((line) =>
                        DockerDaemon.parseContainerLogLine(
                            line,
                            sanitize_callback,
                        ),
                    )
                    .forEach((log_entry) => observer.next(log_entry));
            });

            dockerodeLogStream.on('end', () => observer.complete());
            dockerodeLogStream.on('error', (error) => observer.error(error));
        });
    }
}
