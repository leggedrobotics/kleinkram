import { ContainerLog } from '@common/entities/action/action.entity';
import environment from '@common/environment';
import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import fs from 'node:fs';
import process from 'node:process';
import { inspect } from 'node:util';
import { Observable } from 'rxjs';
import logger from '../../logger';
import { tracing } from '../../tracing';
import {
    CapDrop,
    LogConfig,
    NetworkMode,
    PidsLimit,
    SecurityOpt,
} from '../helper/container-configs';
import { createDriveFolder } from '../helper/drive-helper';

export interface ContainerLimits {
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
}

const defaultContainerLimitations: ContainerLimits = {
    max_runtime: 60 * 60 * 1000, // 1 hour
    memory_limit: 1024 * 1024 * 1024, // 1GB
    n_cpu: 2, // CPU limit in nano CPUs
    disk_quota: 40_737_418_240,
};

export type ContainerEnvironment = Record<string, string>;

export interface ContainerStartOptions {
    docker_image: string; // the docker image to run
    name: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    needs_gpu?: boolean;
    environment?: ContainerEnvironment;
    command?: string;
    entrypoint?: string;
}

export const dockerDaemonErrorHandler = (error: unknown): void => {
    logger.error((error as { message: string }).message);
};

const artifactUploaderImage =
    environment.ARTIFACTS_UPLOADER_IMAGE ||
    'rslethz/grandtour-datasets:artifact-uploader-latest';

/**
 * The DockerDaemon class is responsible for managing the Docker daemon.
 * It provides methods to start, stop, and get logs from containers.
 *
 */
@Injectable()
export class DockerDaemon {
    readonly docker: Dockerode;

    static readonly CONTAINER_PREFIX = 'kleinkram-user-action-';

    constructor() {
        this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
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

        if (containerOptions.docker_image === undefined) {
            throw new Error('No docker image specified');
        }

        if (containerOptions.name === undefined) {
            throw new Error('No name specified');
        }

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
            DeviceRequests: [
                {
                    Driver: 'nvidia',
                    Count: 1,
                    Capabilities: [['gpu']],
                },
            ],
        };

        logger.info(
            needsGpu
                ? 'Creating container with GPU support'
                : 'Creating container without GPU support',
        );
        const containerCreateOptions: Dockerode.ContainerCreateOptions = {
            Image: containerOptions.docker_image,
            name: DockerDaemon.CONTAINER_PREFIX + containerOptions.name,
            Env: Object.entries(containerOptions.environment ?? {}).map(
                ([key, value]) => `${key}=${value}`,
            ),
            Cmd: containerOptions.command
                ? containerOptions.command.split(' ')
                : [],
            HostConfig: {
                ...(needsGpu ? addGpuCapabilities : {}),
                Memory: containerOptions.limits?.memory_limit, // memory limit in bytes
                NanoCpus: (containerOptions.limits?.n_cpu ?? 0) * 1_000_000_000, // CPU limit in nano CPUs
                DiskQuota: containerOptions.limits?.disk_quota,
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
        };
        if (containerOptions.entrypoint) {
            containerCreateOptions.Entrypoint = containerOptions.entrypoint;
        }
        await start();
        const container = await this.docker
            .createContainer(containerCreateOptions)
            .catch(this.errorHandling());

        if (!container) {
            throw new Error('Failed to create container');
        }

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        await this.killContainerAfterMaxRuntime(
            container,
            containerOptions.limits?.max_runtime ?? 0,
        );

        return { container, repoDigests: repoDigests, sha };
    }

    private errorHandling() {
        return (error: unknown) => {
            let errorString = inspect(error);

            // cleanup error message
            errorString = errorString.replaceAll(/\(.*?\)/g, '');
            errorString = errorString.replaceAll(/ +/g, ' ').trim();
            logger.error(`Failed to create container: ${errorString}`);
            throw error;
        };
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
    private async killContainerAfterMaxRuntime(
        container: Dockerode.Container,
        maxRuntimeMs: number,
        clearVolume = false,
    ) {
        const cancelTimeout = setTimeout(() => {
            logger.info(
                `Stopping container ${container.id} after ${maxRuntimeMs.toString()}ms`,
            );

            // initialize a kill timeout
            const killTimout = setTimeout(() => {
                logger.info(
                    `Killing container ${container.id} after 10 seconds of stopping`,
                );
                this.killAndRemoveContainer(container.id, clearVolume).catch(
                    (error: unknown) => logger.error(error),
                );
            }, 10_000);

            this.stopContainer(container.id)
                .then(() => {
                    clearTimeout(killTimout);
                    // clear the kill timeout
                    this.removeContainer(container.id, clearVolume);
                })
                .catch((error: unknown) => logger.error(error));
        }, maxRuntimeMs);

        await container.wait().finally(() => {
            clearTimeout(cancelTimeout); // clear the cancel timeout
        });
    }

    @tracing()
    private async pullImage(dockerImage: string) {
        if (!(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        if (dockerImage === '') {
            throw new Error('No docker image specified');
        }

        const DOCKER_HUB_PASSWORD = process.env['DOCKER_HUB_PASSWORD'];
        const DOCKER_HUB_USERNAME = process.env['DOCKER_HUB_USERNAME'];

        if (
            DOCKER_HUB_PASSWORD === undefined ||
            DOCKER_HUB_USERNAME === undefined
        ) {
            throw new Error('Docker Hub credentials not set');
        }

        // pull the image from the docker hub
        logger.info(`Pulling image: ${dockerImage}`);
        const pullStream = await this.docker.pull(dockerImage, {
            authconfig: {
                auth: '',
                serveraddress: 'https://index.docker.io/v1',
                username: DOCKER_HUB_USERNAME,
                password: DOCKER_HUB_PASSWORD,
            },
        });
        return new Promise((result) => {
            this.docker.modem.followProgress(pullStream, result);
        });
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

        await this.pullImage(dockerImage).catch(this.errorHandling());

        return this.docker.getImage(dockerImage);
    }

    async stopContainer(containerId: string): Promise<void> {
        await this.docker
            .getContainer(containerId)
            .stop()
            .catch(dockerDaemonErrorHandler);
    }

    async killAndRemoveContainer(
        containerId: string,
        clearVolume = false,
    ): Promise<void> {
        await this.killContainer(containerId);
        this.removeContainer(containerId, clearVolume);
    }

    async killContainer(containerId: string): Promise<void> {
        await this.docker
            .getContainer(containerId)
            .kill()
            .catch(dockerDaemonErrorHandler);
    }

    removeContainer(containerId: string, clearVolume = false): void {
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
        await volume.remove().catch(async (error: unknown) => {
            const errorString = inspect(error);
            if (errorString.includes('volume is in use')) {
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
        sanitizeCallback?: (string_: string) => string,
    ): ContainerLog {
        const logLevel = [...line][0]?.charCodeAt(0) ?? 0;

        // remove all non-printable characters
        line = line.replace(/[\u0000-\u001F\u007F]/u, '');

        const dateStartIndex = line.indexOf('20');
        let dateEndIndex = line.indexOf(' ', dateStartIndex);
        dateEndIndex = dateEndIndex === -1 ? line.length : dateEndIndex;

        const dateString = line.slice(dateStartIndex, dateEndIndex);
        const timestamp = new Date(dateString).toISOString();

        let message = line.slice(Math.max(0, dateEndIndex));
        if (sanitizeCallback && message !== '') {
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
        sanitizeCallback?: (string_: string) => string,
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
                for (const logEntry of chunk
                    .toString()
                    .split('\n')
                    .filter((line) => line !== '')
                    .map((line) =>
                        DockerDaemon.parseContainerLogLine(
                            line,
                            sanitizeCallback,
                        ),
                    )) {
                    observer.next(logEntry);
                }
            });

            dockerodeLogStream.on('end', () => {
                observer.complete();
            });
            dockerodeLogStream.on('error', (error) => {
                observer.error(error);
            });
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
            const pullResult = await this.pullImage(
                artifactUploaderImage,
            ).catch(this.errorHandling());

            logger.info(`Image pulled: ${pullResult}. Starting container...`);
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
            environment.GOOGLE_ARTIFACT_UPLOADER_KEY_FILE,
            'utf8',
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
            Image: artifactUploaderImage,
            name: `kleinkram-artifact-uploader-${containerId}`,
            Env: [
                `DRIVE_PARENT_FOLDER_ID=${parentFolder}`,
                `GOOGLE_KEY=${googleKey}`,
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
        };

        const container: Dockerode.Container = await this.docker
            .createContainer(containerCreateOptions)
            .catch(this.errorHandling());
        if (!container) {
            throw new Error('Failed to create container');
        }

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after max_runtime seconds
        await this.killContainerAfterMaxRuntime(
            container,
            containerOptions.limits.max_runtime,
            true,
        );

        return { container, repoDigests, parentFolder };
    }
}
