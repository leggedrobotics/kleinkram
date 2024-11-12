import Docker from 'dockerode';
import Dockerode from 'dockerode';
import { tracing } from '../../tracing';
import logger from '../../logger';
import { ContainerLog } from '@common/entities/action/action.entity';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import process from 'node:process';
import Env from '@common/env';
import env from '@common/env';
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
    /* eslint-disable @typescript-eslint/naming-convention */
    /**
     * The maximum runtime of the container in milliseconds.
     */
    max_runtime: number;
    /**
     * The maximum memory the container can use in bytes.
     */
    memory_limit: number;
    /**
     * The maximum number of CPU cores.
     */
    n_cpu: number;
    /**
     * The maximum disk space the container can use in bytes.
     */
    disk_quota: number;
    /* eslint-enable @typescript-eslint/naming-convention */
};

const defaultContainerLimitations: ContainerLimits = {
    /* eslint-disable @typescript-eslint/naming-convention */
    max_runtime: 60 * 60 * 1_000, // 1 hour
    memory_limit: 1024 * 1024 * 1024, // 1GB
    n_cpu: 2, // CPU limit in nano CPUs
    disk_quota: 40737418240,
    /* eslint-enable @typescript-eslint/naming-convention */
};

export type ContainerEnv = {
    [key: string]: string;
};

export type ContainerStartOptions = {
    /* eslint-disable @typescript-eslint/naming-convention */
    docker_image: string; // the docker image to run
    name: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    needs_gpu?: boolean;
    environment?: ContainerEnv;
    command?: string;
    entrypoint?: string;
    /* eslint-enable @typescript-eslint/naming-convention */
};

export const dockerDaemonErrorHandler = (error: Error) => {
    logger.error(error.message);
    return null;
};

const artifactUploaderImage =
    env.ARTIFACTS_UPLOADER_IMAGE ||
    'rslethz/grandtour-datasets:artifact-uploader-latest';

/**
 * The DockerDaemon class is responsible for managing the Docker daemon.
 * It provides methods to start, stop, and get logs from containers.
 *
 */
@Injectable()
export class DockerDaemon {
    readonly docker: Docker;

    // eslint-disable-next-line @typescript-eslint/naming-convention
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
     * @param containerOptions
     * @param start
     * @returns the container object
     * @throws Error if the docker image is not from the rslethz organization
     *
     */
    @tracing()
    async startContainer(
        start: () => Promise<void>,
        containerOptions?: Partial<ContainerStartOptions>,
    ): Promise<{
        container: Dockerode.Container;
        repoDigests: string[];
        sha: string;
    }> {
        // merge the given container limitations with the default ones
        if (!containerOptions) containerOptions = {};
        containerOptions = {
            ...containerOptions,
            limits: {
                ...defaultContainerLimitations,
                ...containerOptions.limits,
            },
            environment: { ...containerOptions.environment },
        };

        logger.debug(
            `Starting container with options: ${JSON.stringify(containerOptions)}`,
        );
        const image = await this.getImage(containerOptions.docker_image);
        // get image details
        const details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Image ${containerOptions.docker_image} not found, could not start container!`,
            );
        }
        const repoDigests = details.RepoDigests;
        const sha = '';
        const needsGpu = containerOptions.needs_gpu || false;
        const addGpuCapabilities = {
            /* eslint-disable @typescript-eslint/naming-convention */
            DeviceRequests: [
                {
                    Driver: 'nvidia',
                    Count: 1,
                    Capabilities: [['gpu']],
                },
            ],
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        logger.info(
            needsGpu
                ? 'Creating container with GPU support'
                : 'Creating container without GPU support',
        );
        const containerCreateOptions: Dockerode.ContainerCreateOptions = {
            /* eslint-disable @typescript-eslint/naming-convention */
            Image: containerOptions.docker_image,
            name: DockerDaemon.CONTAINER_PREFIX + containerOptions.name,
            Env: Object.entries(containerOptions.environment).map(
                ([key, value]) => `${key}=${value}`,
            ),
            Cmd: containerOptions.command
                ? containerOptions.command.split(' ')
                : [],
            HostConfig: {
                ...(needsGpu ? addGpuCapabilities : {}),
                Memory: containerOptions.limits.memory_limit, // memory limit in bytes
                NanoCpus: containerOptions.limits.n_cpu * 1_000_000_000, // CPU limit in nano CPUs
                DiskQuota: containerOptions.limits.disk_quota,

                NetworkMode,
                LogConfig,
                CapDrop,
                SecurityOpt,
                PidsLimit,
                // Define a unique volume
                Mounts: [
                    {
                        Target: '/out', // Inside container
                        Source: `vol-${containerOptions.name}`, // Volume name
                        Type: 'volume', // Use Docker-managed volume
                    },
                ],
            },
            Volumes: {
                '/tmp_disk': {},
            },
            /* eslint-enable @typescript-eslint/naming-convention */
        };
        if (containerOptions.entrypoint) {
            containerCreateOptions.Entrypoint = containerOptions.entrypoint;
        }
        await start();
        const container = await this.docker
            .createContainer(containerCreateOptions)
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
            containerOptions.limits.max_runtime,
        );

        return { container, repoDigests: repoDigests, sha };
    }

    /**
     * Kill a container after maxRuntimeMs milliseconds.
     *
     * The OS sends a SIGTERM signal to the container, which allows the container to
     * gracefully shut down. If the container does not stop after 10 seconds, it is
     * forcefully killed (SIGKILL).
     *
     * @param container
     * @param maxRuntimeMs
     * @param clearVolume - if true, the volume is removed after the container is stopped
     * @private
     */
    private killContainerAfterMaxRuntime(
        container: Dockerode.Container,
        maxRuntimeMs: number,
        clearVolume = false,
    ) {
        const cancelTimeout = setTimeout(async () => {
            logger.info(
                `Stopping container ${container.id} after ${maxRuntimeMs}ms`,
            );

            // initialize a kill timeout
            const killTimout = setTimeout(async () => {
                logger.info(
                    `Killing container ${container.id} after 10 seconds of stopping`,
                );
                await this.killAndRemoveContainer(container.id, clearVolume);
            }, 10_000);

            await this.stopContainer(container.id);
            clearTimeout(killTimout); // clear the kill timeout
            await this.removeContainer(container.id, clearVolume);
        }, maxRuntimeMs);

        container.wait().finally(() => {
            clearTimeout(cancelTimeout); // clear the cancel timeout
        });
    }

    @tracing()
    private async pullImage(dockerImage: string) {
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        if (!dockerImage || dockerImage === '') {
            throw new Error('No docker image specified');
        }

        // pull the image from the docker hub
        logger.info(`Pulling image: ${dockerImage}`);
        const pullStream = await this.docker.pull(dockerImage, {
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

    @tracing()
    private async getImage(dockerImage: string) {
        // assert that we only run rslethz images
        if (!dockerImage.startsWith('rslethz/')) {
            throw new Error(
                'Only images from the rslethz organization are allowed',
            );
        }

        // check if docker socket is available
        if (!this.docker || !(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        await this.pullImage(dockerImage).catch((error) => {
            // cleanup error message
            error.message = error.message.replace(/\(.*?\)/g, '');
            error.message = error.message.replace(/ +/g, ' ').trim();
            logger.warn(`Failed to pull image: ${error.message}`);
        });

        return this.docker.getImage(dockerImage);
    }

    async stopContainer(containerId: string) {
        await this.docker
            .getContainer(containerId)
            .stop()
            .catch(dockerDaemonErrorHandler);
    }

    async killAndRemoveContainer(containerId: string, clearVolume = false) {
        await this.killContainer(containerId);
        await this.removeContainer(containerId, clearVolume);
    }

    async killContainer(containerId: string) {
        await this.docker
            .getContainer(containerId)
            .kill()
            .catch(dockerDaemonErrorHandler);
    }

    async removeContainer(containerId: string, clearVolume = false) {
        const container = this.docker.getContainer(containerId);
        if (container) {
            container
                .remove({ v: clearVolume })
                .catch(dockerDaemonErrorHandler);
        }
    }

    async removeVolume(containerId: string) {
        const volumeName = `vol-${containerId}`;
        const volume = this.docker.getVolume(volumeName);

        // try to remove volume, if in use wait and try again
        await volume.remove().catch(async (error) => {
            if (error.message.includes('volume is in use')) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                await volume.remove().catch(dockerDaemonErrorHandler);
            } else {
                dockerDaemonErrorHandler(error);
            }
        });
    }

    /**
     * Parse a log line from a container.
     *
     * @param line
     * @param sanitizeCallback
     * @private
     */
    private static parseContainerLogLine(
        line: string,
        sanitizeCallback?: (str: string) => string,
    ): ContainerLog {
        const logLevel = line.split('')[0].charCodeAt(0);

        // remove all non-printable characters
        line = line.replace(/[\x00-\x1F\x7F]/u, '');

        const dateStartIdx = line.indexOf('20');
        let dateEndIdx = line.indexOf(' ', dateStartIdx);
        dateEndIdx = dateEndIdx === -1 ? line.length : dateEndIdx;

        const dateStr = line.substring(dateStartIdx, dateEndIdx);
        const timestamp = new Date(dateStr).toISOString();

        let message = line.substring(dateEndIdx);
        if (sanitizeCallback && message != '') {
            message = sanitizeCallback(message);
        }

        return {
            timestamp: timestamp,
            message: message,
            type: logLevel === 2 ? 'stderr' : 'stdout',
        };
    }

    /**
     * Subscribe to the logs of a container.
     * The logs are parsed and returned as an observable.
     *
     * @param containerId the id of the container
     * @param sanitizeCallback a callback function to sanitize the log messages
     *                       before they are emitted (e.g. to remove sensitive information
     *                       like api keys)
     * @returns an observable that emits log entries
     */
    @tracing()
    async subscribeToLogs(
        containerId: string,
        sanitizeCallback?: (str: string) => string,
    ) {
        const container = this.docker.getContainer(containerId);

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
                            sanitizeCallback,
                        ),
                    )
                    .forEach((logEntry) => observer.next(logEntry));
            });

            dockerodeLogStream.on('end', () => observer.complete());
            dockerodeLogStream.on('error', (error) => observer.error(error));
        });
    }

    @tracing()
    async launchArtifactUploadContainer(
        containerId: string,
        actionName: string,
    ) {
        const parentFolder = await createDriveFolder(actionName);

        // merge the given container limitations with the default ones
        const containerOptions = {
            limits: defaultContainerLimitations,
        };

        logger.debug(
            `Starting container with options: ${JSON.stringify(containerOptions)}`,
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
            const pullRes = await this.pullImage(artifactUploaderImage).catch(
                (error) => {
                    // cleanup error message
                    error.message = error.message.replace(/\(.*?\)/g, '');
                    error.message = error.message.replace(/ +/g, ' ').trim();

                    logger.warn(`Failed to pull image: ${error.message}`);
                },
            );

            logger.info(`Image pulled: ${pullRes}. Starting container...`);
            image = this.docker.getImage(artifactUploaderImage);
        }

        // get image details
        details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Crashed during Artifacts upload. Image ${artifactUploaderImage} not found!`,
            );
        }
        const repoDigests = details.RepoDigests;
        const googleKey = fs.readFileSync(
            Env.GOOGLE_ARTIFACT_UPLOADER_KEY_FILE,
            'utf-8',
        );

        // assert non empty env variables
        if (!googleKey || googleKey === '') {
            throw new Error('Google key not found');
        }

        if (!parentFolder || parentFolder === '') {
            throw new Error('Parent folder not found');
        }

        logger.info('Creating artifact uploader container...');
        const containerCreateOptions: Dockerode.ContainerCreateOptions = {
            /* eslint-disable @typescript-eslint/naming-convention */
            Image: artifactUploaderImage,
            name: 'kleinkram-artifact-uploader-' + containerId,
            Env: [
                'DRIVE_PARENT_FOLDER_ID=' + parentFolder,
                'GOOGLE_KEY=' + googleKey,
            ],

            HostConfig: {
                Memory: containerOptions.limits.memory_limit, // memory limit in bytes
                NanoCpus: containerOptions.limits.n_cpu * 1_000_000_000, // CPU limit in nano CPUs
                DiskQuota: containerOptions.limits.disk_quota,
                NetworkMode,
                LogConfig,
                CapDrop,
                SecurityOpt,
                PidsLimit,
                Mounts: [
                    {
                        Target: '/out',
                        Source: `vol-${containerId}`,
                        Type: 'volume',
                    },
                ],
            },
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        const container = await this.docker
            .createContainer(containerCreateOptions)
            .catch((error) => {
                if (env.DEV) {
                    // cleanup error message
                    error.message = error.message.replace(/\(.*?\)/g, '');
                    error.message = error.message.replace(/ +/g, ' ').trim();
                } else {
                    error.message =
                        'Failed to launch artifact uploader container';
                }
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
            containerOptions.limits.max_runtime,
            true,
        );

        return { container, repoDigests, parentFolder };
    }
}
