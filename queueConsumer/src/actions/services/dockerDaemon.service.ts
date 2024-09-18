import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../../tracing';
import logger from '../../logger';
import { ContainerLog } from '@common/entities/action/action.entity';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import process from 'node:process';
import Env from '@common/env';
import { createDriveFolder } from '../helper/driveHelper';
import fs from 'node:fs';
import {
    CapDrop,
    LogConfig,
    NetworkMode,
    PidsLimit,
    SecurityOpt,
} from '../helper/ContainerConfigs';

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
    command?: string;
};

export const dockerDaemonErrorHandler = (error: Error) => {
    logger.error(error.message);
    return null;
};

const artifactUploaderImage =
    'rslethz/grandtour-datasets:artifact-uploader-latest';

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
        sha: string;
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
        let image = this.docker.getImage(container_options.docker_image);
        let details = await image.inspect().catch(dockerDaemonErrorHandler);
        logger.info(
            `Checking if image ${container_options.docker_image} exists...`,
        );
        if (!details) {
            logger.info('Image does not exist, pulling image...');
            const pull_res = await this.pull_image(
                container_options.docker_image,
            ).catch((error) => {
                // cleanup error message
                error.message = error.message.replace(/\(.*?\)/g, '');
                error.message = error.message.replace(/ +/g, ' ').trim();

                logger.warn(`Failed to pull image: ${error.message}`);
            });

            logger.info(`Image pulled: ${pull_res}. Starting container...`);
            image = this.docker.getImage(container_options.docker_image);
        }

        // get image details
        details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Image ${container_options.docker_image} not found, could not start container!`,
            );
        }
        const repo_digests = details.RepoDigests;
        const sha = '';
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
            Cmd: container_options.command
                ? container_options.command.split(' ')
                : [],

            HostConfig: {
                ...(needs_gpu ? add_gpu_capabilities : {}),
                Memory: container_options.limits.memory_limit, // memory limit in bytes
                NanoCpus: container_options.limits.cpu_limit, // CPU limit in nano CPUs
                DiskQuota: container_options.limits.disk_quota,

                NetworkMode,
                LogConfig,
                CapDrop,
                SecurityOpt,
                PidsLimit,
                // Define a unique volume
                Mounts: [
                    {
                        Target: '/out', // Inside container
                        Source: `vol-${container_options.name}`, // Volume name
                        Type: 'volume', // Use Docker-managed volume
                    },
                ],
            },
            Volumes: { '/out': {} },
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

        return { container, repo_digests, sha };
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
     * @param clear_volume - if true, the volume is removed after the container is stopped
     * @private
     */
    private killContainerAfterMaxRuntime(
        container: Dockerode.Container,
        max_runtime_ms: number,
        clear_volume = false,
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
                await this.killAndRemoveContainer(container.id, clear_volume);
            }, 10_000);

            await this.stopContainer(container.id);
            clearTimeout(killTimout); // clear the kill timeout
            await this.removeContainer(container.id, clear_volume);
        }, max_runtime_ms);

        container.wait().finally(() => {
            clearTimeout(cancel_timeout); // clear the cancel timeout
        });
    }

    @tracing()
    private async pull_image(docker_image: string) {
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        if (!docker_image || docker_image === '') {
            throw new Error('No docker image specified');
        }

        // pull the image from the docker hub
        logger.info(`Pulling image: ${docker_image}`);
        const pullStream = await this.docker.pull(docker_image, {
            authconfig: {
                auth: '',
                serveraddress: 'https://index.docker.io/v1',
                password: process.env.DOCKER_HUB_PASSWORD,
                username: process.env.DOCKER_HUB_USERNAME,
            },
        });
        return new Promise((res) =>
            this.docker.modem.followProgress(pullStream, res),
        );
    }

    async stopContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .stop()
            .catch(dockerDaemonErrorHandler);
    }

    async killAndRemoveContainer(container_id: string, clear_volume = false) {
        await this.killContainer(container_id);
        await this.removeContainer(container_id, clear_volume);
    }

    async killContainer(container_id: string) {
        await this.docker
            .getContainer(container_id)
            .kill()
            .catch(dockerDaemonErrorHandler);
    }

    async removeContainer(container_id: string, clear_volume = false) {
        const container = this.docker.getContainer(container_id);
        if (container) {
            container
                .remove({ v: clear_volume })
                .catch(dockerDaemonErrorHandler);
        }
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

    @tracing()
    async launchArtifactUploadContainer(
        container_id: string,
        action_name: string,
    ) {
        const parentFolder = await createDriveFolder(action_name);

        // merge the given container limitations with the default ones
        const container_options = {
            limits: defaultContainerLimitations,
        };

        logger.debug(
            `Starting container with options: ${JSON.stringify(container_options)}`,
        );

        // check if docker socket is available
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }
        let image = this.docker.getImage(artifactUploaderImage);
        let details = await image.inspect().catch(dockerDaemonErrorHandler);
        logger.info(`Checking if image ${artifactUploaderImage} exists...`);
        if (!details) {
            logger.info('Image does not exist, pulling image...');
            const pull_res = await this.pull_image(artifactUploaderImage).catch(
                (error) => {
                    // cleanup error message
                    error.message = error.message.replace(/\(.*?\)/g, '');
                    error.message = error.message.replace(/ +/g, ' ').trim();

                    logger.warn(`Failed to pull image: ${error.message}`);
                },
            );

            logger.info(`Image pulled: ${pull_res}. Starting container...`);
            image = this.docker.getImage(artifactUploaderImage);
        }

        // get image details
        details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Image ${artifactUploaderImage} not found, could not start container!`,
            );
        }
        const repo_digests = details.RepoDigests;
        const google_key = fs.readFileSync(
            Env.GOOGLE_ARTIFACT_UPLOADER_KEY_FILE,
            'utf-8',
        );

        // assert non empty env variables
        if (!google_key || google_key === '') {
            throw new Error('Google key not found');
        }

        if (!parentFolder || parentFolder === '') {
            throw new Error('Parent folder not found');
        }

        logger.info('Creating artifact uploader container...');
        const container_create_options: Dockerode.ContainerCreateOptions = {
            Image: artifactUploaderImage,
            name: 'kleinkram-artifact-uploader-' + container_id,
            Env: [
                'DRIVE_PARENT_FOLDER_ID=' + parentFolder,
                'GOOGLE_KEY=' + google_key,
            ],

            HostConfig: {
                Memory: container_options.limits.memory_limit, // memory limit in bytes
                NanoCpus: container_options.limits.cpu_limit, // CPU limit in nano CPUs
                DiskQuota: container_options.limits.disk_quota,
                NetworkMode,
                LogConfig,
                CapDrop,
                SecurityOpt,
                PidsLimit,
                Mounts: [
                    {
                        Target: '/out',
                        Source: `vol-${container_id}`,
                        Type: 'volume',
                    },
                ],
            },
            Volumes: { '/out': {} },
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
            true,
        );

        return { container, repo_digests, parentFolder };
    }
}
