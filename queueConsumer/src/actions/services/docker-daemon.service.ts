import { ContainerLog } from '@kleinkram/backend-common/entities/action/action.entity';
import environment from '@kleinkram/backend-common/environment';
import { ImageSource, LogType } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import Dockerode, { Image } from 'dockerode';
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
import { ImageResolutionService } from './image-resolution.service';

export interface ContainerLimits {
    /**
     * The maximum runtime of the container in milliseconds.
     */

    // eslint-disable-next-line @typescript-eslint/naming-convention
    max_runtime: number;
    /**
     * The maximum memory the container can use in bytes.
     // eslint-disable-next-line @typescript-eslint/naming-convention
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    memory_limit: number;
    /**
     // eslint-disable-next-line @typescript-eslint/naming-convention
     * The maximum number of CPU cores.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    n_cpu: number;

    /**
     // eslint-disable-next-line @typescript-eslint/naming-convention
     * The maximum disk space the container can use in bytes.
     */

    // eslint-disable-next-line @typescript-eslint/naming-convention
    disk_quota: number;
}

const defaultContainerLimitations: ContainerLimits = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    max_runtime: 60 * 60 * 1000, // 1 hour
    // eslint-disable-next-line @typescript-eslint/naming-convention
    memory_limit: 1024 * 1024 * 1024, // 1GB

    // eslint-disable-next-line @typescript-eslint/naming-convention
    n_cpu: 2, // CPU limit in nano CPUs

    // eslint-disable-next-line @typescript-eslint/naming-convention
    disk_quota: 40_737_418_240,
};

export type ContainerEnvironment = Record<string, string>;

export interface ContainerStartOptions {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    docker_image: string; // the docker image to run
    name: string; // a unique identifier for the container
    limits?: Partial<ContainerLimits>;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    needs_gpu?: boolean;
    environment?: ContainerEnvironment;
    command?: string;
    entrypoint?: string;
    labels?: Record<string, string>;
}

export const dockerDaemonErrorHandler = (error: unknown): void => {
    logger.error((error as { message: string }).message);
};

const artifactUploaderImage =
    environment.ARTIFACTS_UPLOADER_IMAGE ||
    'rslethz/kleinkram:artifact-uploader-latest';

/**
 * The DockerDaemon class is responsible for managing the Docker daemon.
 * It provides methods to start, stop, and get logs from containers.
 *
 */
@Injectable()
export class DockerDaemon {
    readonly docker: Dockerode;

    static readonly CONTAINER_PREFIX = 'kleinkram-user-action-';

    constructor(
        private readonly imageResolutionService: ImageResolutionService,
    ) {
        this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    }

    static getArtifactVolumeName(runnerId: string, actionUuid: string): string {
        return `vol-${runnerId}-${actionUuid}`;
    }

    async removeArtifactVolume(
        runnerId: string,
        actionUuid: string,
    ): Promise<void> {
        const volumeName = DockerDaemon.getArtifactVolumeName(
            runnerId,
            actionUuid,
        );
        return this.removeDockerVolume(volumeName);
    }

    /**
     * Start a container with the given action and uuid.
     *
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
        source: ImageSource;
        localCreatedAt: Date | undefined;
        remoteCreatedAt: Date | undefined;
        containerLimits: ContainerLimits;
        needsGpu: boolean;
        volumeName: string;
    }> {
        // merge the given container limitations with the default ones
        containerOptions ??= {};
        const runLimits = {
            ...defaultContainerLimitations,
            ...containerOptions.limits,
        };
        const runOptions = {
            ...containerOptions,
            limits: runLimits,
            environment: { ...containerOptions.environment },
        };

        logger.debug(
            `Starting container with options: ${JSON.stringify(runOptions)}`,
        );

        if (runOptions.docker_image === undefined) {
            throw new Error('No docker image specified');
        }

        if (runOptions.name === undefined) {
            throw new Error('No name specified');
        }

        const { image, source, localCreatedAt, remoteCreatedAt } =
            await this.getImage(runOptions.docker_image);
        // get image details
        const details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Image '${runOptions.docker_image}' not found, could not start container!`,
            );
        }
        const repoDigests = details.RepoDigests;
        const sha = details.Id;
        const needsGpu = runOptions.needs_gpu ?? false;
        const addGpuCapabilities = {
            DeviceRequests: [
                {
                    Driver: 'nvidia',
                    Count: 1,
                    Capabilities: [['gpu']],
                },
            ],
        };

        const volumeName = `vol-${runOptions.name}`;

        logger.debug(
            needsGpu
                ? 'Creating container with GPU acceleration'
                : 'Creating container without GPU acceleration',
        );
        const containerCreateOptions: Dockerode.ContainerCreateOptions = {
            Image: runOptions.docker_image,
            name: DockerDaemon.CONTAINER_PREFIX + runOptions.name,
            Labels: runOptions.labels,
            Env: Object.entries(runOptions.environment).map(
                ([key, value]) => `${key}=${value}`,
            ),
            Cmd: runOptions.command ? runOptions.command.split(' ') : [],
            HostConfig: {
                ...(needsGpu ? addGpuCapabilities : {}),
                Memory: runLimits.memory_limit, // memory limit in bytes
                NanoCpus: runLimits.n_cpu * 1_000_000_000, // CPU limit in nano CPUs
                DiskQuota: runLimits.disk_quota,
                NetworkMode,
                LogConfig,
                CapDrop,
                SecurityOpt,
                PidsLimit,

                // Define a unique volume
                Mounts: [
                    {
                        Target: '/out', // Inside container
                        Source: volumeName, // Volume name
                        Type: 'volume', // Use Docker-managed volume
                    },
                ],
            },
            Volumes: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '/tmp_disk': {},
            },
        };
        if (runOptions.entrypoint) {
            containerCreateOptions.Entrypoint = runOptions.entrypoint;
        }
        await start();
        const container = await this.docker
            .createContainer(containerCreateOptions)
            .catch(this.errorHandling());

        logger.debug('Container created! Starting container...');
        await container.start();
        logger.debug(`Container started with id: ${container.id}`);

        return {
            container,
            repoDigests: repoDigests,
            sha,
            source,
            localCreatedAt,
            remoteCreatedAt,
            containerLimits: runLimits,
            needsGpu: needsGpu,
            volumeName: volumeName,
        };
    }

    private errorHandling() {
        // eslint-disable-next-line unicorn/consistent-function-scoping
        return (error: unknown): never => {
            let errorString = inspect(error);

            // cleanup error message
            errorString = errorString.replaceAll(/\(.*?\)/g, '');
            errorString = errorString.replaceAll(/ +/g, ' ').trim();
            logger.error(`Failed to create container: ${errorString}`);
            throw error;
        };
    }

    @tracing()
    private async pullImage(dockerImage: string): Promise<unknown> {
        if (!(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        if (dockerImage === '') {
            throw new Error('No docker image specified');
        }

        const DOCKER_HUB_PASSWORD = process.env.DOCKER_HUB_PASSWORD;
        const DOCKER_HUB_USERNAME = process.env.DOCKER_HUB_USERNAME;

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
    private async getImage(dockerImage: string): Promise<{
        image: Image;
        source: ImageSource;
        localCreatedAt: Date | undefined;
        remoteCreatedAt: Date | undefined;
    }> {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const dockerhub_namespace = process.env.VITE_DOCKER_HUB_NAMESPACE;
        // assert that we only run images from a specified namespace
        if (
            dockerhub_namespace !== undefined &&
            !dockerImage.startsWith(dockerhub_namespace)
        ) {
            throw new Error(
                `Only images from the ${dockerhub_namespace} namespace are allowed`,
            );
        }

        // check if docker socket is available
        if (!(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        const { source, localCreatedAt, remoteCreatedAt, shouldPull } =
            await this.imageResolutionService.resolveImage(
                this.docker,
                dockerImage,
            );

        if (shouldPull) {
            await this.pullImage(dockerImage);
        }

        return {
            image: this.docker.getImage(dockerImage),
            source,
            localCreatedAt,
            remoteCreatedAt,
        };
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
        container.remove({ v: clearVolume }).catch(dockerDaemonErrorHandler);
    }

    async removeVolume(containerId: string): Promise<void> {
        const volumeName = `vol-${containerId}`;
        return this.removeDockerVolume(volumeName);
    }

    private async removeDockerVolume(volumeName: string): Promise<void> {
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
        const logLevel = line.codePointAt(0) ?? 0;

        // Strip ANSI codes first

        const ansiRegex =
            /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
        line = line.replaceAll(ansiRegex, '');

        // remove all non-printable characters

        line = line.replace(/[\u0000-\u001F\u007F]/u, '');

        const dateStartIndex = line.indexOf('20');

        let timestamp: string;
        let message: string;

        if (dateStartIndex === -1) {
            timestamp = new Date().toISOString();
            message = line;
        } else {
            let dateEndIndex = line.indexOf(' ', dateStartIndex);
            dateEndIndex = dateEndIndex === -1 ? line.length : dateEndIndex;

            const dateString = line.slice(dateStartIndex, dateEndIndex);
            try {
                timestamp = new Date(dateString).toISOString();
            } catch {
                timestamp = new Date().toISOString();
            }

            message = line.slice(Math.max(0, dateEndIndex));
        }

        if (sanitizeCallback && message !== '') {
            message = sanitizeCallback(message);
        }

        return {
            timestamp: timestamp,
            message: message,
            type: logLevel === 2 ? LogType.STDERR : LogType.STDOUT,
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
    ): Promise<Observable<ContainerLog>> {
        const container = this.docker.getContainer(containerId);

        const dockerodeLogStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            details: true,
            timestamps: true,
        });

        return new Observable<ContainerLog>((observer) => {
            dockerodeLogStream.on('data', (chunk: Buffer) => {
                const lines = chunk
                    .toString()
                    .split(/[\r\n]+/)
                    .filter((line: string) => line !== '')
                    .map((line: string) =>
                        DockerDaemon.parseContainerLogLine(
                            line,
                            sanitizeCallback,
                        ),
                    );
                for (const logEntry of lines) {
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
        actionUuid: string,
        runnerId: string,
    ): Promise<{
        container: Dockerode.Container;
        repoDigests: string[];
        artifactMetadata?: { size: number; files: string[] } | undefined;
        containerLimits: ContainerLimits;
        volumeName: string;
    }> {
        const containerOptions = { limits: defaultContainerLimitations };

        logger.debug(
            `Starting container with options: ${JSON.stringify(containerOptions)}`,
        );

        // check if docker socket is available
        if (!(await this.docker.ping())) {
            throw new Error('Docker socket not available or not responding');
        }

        const { image } = await this.getImage(artifactUploaderImage);

        // get image details
        const details = await image.inspect().catch(dockerDaemonErrorHandler);
        if (!details) {
            throw new Error(
                `Crashed during Artifacts upload. Image ${artifactUploaderImage} not found!`,
            );
        }
        const repoDigests = details.RepoDigests;

        logger.debug(
            `Creating artifact uploader container from image: ${artifactUploaderImage} with options: ${JSON.stringify(containerOptions)}`,
        );

        const volumeName = DockerDaemon.getArtifactVolumeName(
            runnerId,
            actionUuid,
        );

        const containerCreateOptions: Dockerode.ContainerCreateOptions = {
            Image: artifactUploaderImage,
            name: `kleinkram-artifact-uploader-${actionUuid}`,
            Env: [
                `KLEINKRAM_ACTION_UUID=${actionUuid}`,
                `MINIO_ENDPOINT=${environment.MINIO_ENDPOINT === 'localhost' ? '127.0.0.1' : environment.MINIO_ENDPOINT}${environment.DEV ? ':9000' : ''}`,
                `MINIO_ACCESS_KEY=${environment.MINIO_ACCESS_KEY}`,
                `MINIO_SECRET_KEY=${environment.MINIO_SECRET_KEY}`,
                `MINIO_ARTIFACTS_BUCKET_NAME=${environment.MINIO_ARTIFACTS_BUCKET_NAME}`,
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
                        Source: volumeName,
                        Type: 'volume',
                    },
                ],
            },
        };

        const container: Dockerode.Container = await this.docker
            .createContainer(containerCreateOptions)
            .catch(this.errorHandling());

        logger.debug('Container created! Starting container...');
        await container.start();
        logger.debug(`Container started with id: ${container.id}`);

        // Stream logs to stdout/stderr for debugging and capture metadata
        let artifactMetadata: { size: number; files: string[] } | undefined;

        const stream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
        });

        const logPromise = new Promise<void>((resolve, reject) => {
            let buffer = '';
            const stdoutWritable = {
                write: (chunk: Buffer) => {
                    const chunkString = chunk.toString();
                    buffer += chunkString;

                    const lines = buffer.split('\n');
                    // Keep the last part in the buffer as it might be an incomplete line
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        logger.debug(`[ArtifactUpload] ${line}`);
                        if (line.includes('ARTIFACT_METADATA:')) {
                            try {
                                const jsonString = line
                                    .split('ARTIFACT_METADATA:')[1]
                                    ?.trim();
                                if (jsonString) {
                                    artifactMetadata = JSON.parse(
                                        jsonString,
                                    ) as {
                                        size: number;
                                        files: string[];
                                    };
                                }
                            } catch (error: unknown) {
                                logger.error(
                                    `Failed to parse artifact metadata: ${String(error)}`,
                                );
                            }
                        }
                    }
                    return true;
                },
            };

            const stderrWritable = {
                write: (chunk: Buffer) => {
                    logger.debug(
                        `[ArtifactUpload STDERR] ${chunk.toString().trim()}`,
                    );
                    return true;
                },
            };

            stream.on('end', () => {
                if (buffer) {
                    logger.debug(`[ArtifactUpload] ${buffer}`);
                    if (buffer.includes('ARTIFACT_METADATA:')) {
                        try {
                            const jsonString = buffer
                                .split('ARTIFACT_METADATA:')[1]
                                ?.trim();
                            if (jsonString) {
                                artifactMetadata = JSON.parse(jsonString) as {
                                    size: number;
                                    files: string[];
                                };
                            }
                        } catch (error: unknown) {
                            logger.error(
                                `Failed to parse artifact metadata: ${String(error)}`,
                            );
                        }
                    }
                }
                resolve();
            });

            stream.on('error', reject);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            container.modem.demuxStream(
                stream,
                stdoutWritable as unknown as NodeJS.WritableStream,
                stderrWritable as unknown as NodeJS.WritableStream,
            );
        });

        await logPromise;

        return {
            container,
            repoDigests,
            artifactMetadata,
            containerLimits: containerOptions.limits,
            volumeName,
        };
    }
}
