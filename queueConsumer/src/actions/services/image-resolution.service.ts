import { ImageSource } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../../logger';

const execAsync = promisify(exec);

export interface ImageResolutionResult {
    source: ImageSource;
    localCreatedAt?: Date;
    remoteCreatedAt?: Date;
    shouldPull: boolean;
}

interface DockerImageInspect {
    Created: string;
    RepoDigests?: string[];
}

interface DistributionInspect {
    Descriptor?: { digest?: string };
}

@Injectable()
export class ImageResolutionService {
    async resolveImage(
        docker: Dockerode,
        imageTag: string,
    ): Promise<ImageResolutionResult> {
        // Parallelize fetching metadata to reduce latency
        const [local, remoteDigest] = await Promise.all([
            this.getLocalImageMetadata(docker, imageTag),
            this.getRemoteImageDigest(docker, imageTag).catch(
                (error: unknown): undefined => {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    logger.warn(`Remote registry check failed: ${message}`);
                    return;
                },
            ),
        ]);

        // Pass pure data to a decision engine
        return this.decideResolution(imageTag, local, remoteDigest);
    }

    /**
     * Pure decision logic. Easy to unit test.
     * Flattens nested logic into linear guard clauses.
     */
    private async decideResolution(
        imageTag: string,
        local: { createdAt?: Date; digests: string[] },
        remoteDigest?: string,
    ): Promise<ImageResolutionResult> {
        // CASE 1: No local image -> Must Pull
        if (!local.createdAt) {
            logger.info('Local image missing. Pulling...');
            return {
                source: ImageSource.PULLED,
                shouldPull: true,
                localCreatedAt: undefined,
                remoteCreatedAt: undefined,
            };
        }

        // CASE 2: Remote unavailable -> Use Local Only
        if (!remoteDigest) {
            logger.info(
                'Remote digest unavailable. Using local-only fallback.',
            );
            return {
                source: ImageSource.LOCALLY_BUILT_LOCAL_ONLY,
                shouldPull: false,
                localCreatedAt: local.createdAt,
                remoteCreatedAt: undefined,
            };
        }

        // CASE 3: Digests Match -> Use Cached
        // Note: RepoDigests are usually "image@sha256:...", so we check inclusion
        const isMatch = local.digests.some((d) => d.includes(remoteDigest));
        if (isMatch) {
            logger.debug('Local digest matches remote. Using cached.');
            return {
                source: ImageSource.CACHED,
                shouldPull: false,
                localCreatedAt: local.createdAt,
                remoteCreatedAt: local.createdAt, // assume synced
            };
        }

        // CASE 4: Digest Mismatch -> Check Timestamps
        logger.info('Digest mismatch detected. Checking timestamps...');
        const remoteCreatedAt = await this.fetchRemoteCreationDate(imageTag);

        // If remote is strictly newer, pull.
        if (remoteCreatedAt && remoteCreatedAt > local.createdAt) {
            logger.info('Remote image is newer. Pulling...');
            return {
                source: ImageSource.PULLED,
                shouldPull: true,
                localCreatedAt: local.createdAt,
                remoteCreatedAt,
            };
        }

        // CASE 5: Local is newer or timestamps inconclusive -> Prefer Local
        logger.info(
            'Local image is newer or remote date unknown. Keeping local.',
        );
        return {
            source: ImageSource.LOCALLY_BUILT,
            shouldPull: false,
            localCreatedAt: local.createdAt,
            remoteCreatedAt,
        };
    }

    private async getLocalImageMetadata(
        docker: Dockerode,
        imageTag: string,
    ): Promise<{ createdAt?: Date; digests: string[] }> {
        try {
            const image = docker.getImage(imageTag);
            const inspectData = (await image.inspect()) as DockerImageInspect;
            return {
                createdAt: new Date(inspectData.Created),
                digests: inspectData.RepoDigests ?? [],
            };
        } catch {
            return { digests: [] };
        }
    }

    private async getRemoteImageDigest(
        docker: Dockerode,
        imageTag: string,
    ): Promise<string | undefined> {
        try {
            const data = await this.dockerDial<DistributionInspect>(docker, {
                path: `/distribution/${imageTag}/json`,
                method: 'GET',
                statusCodes: {
                    /* eslint-disable @typescript-eslint/naming-convention */
                    '200': true,
                    '401': true,
                    '403': true,
                    '404': false,
                    /* eslint-enable @typescript-eslint/naming-convention */
                },
            });
            return data.Descriptor?.digest;
        } catch {
            logger.debug(`Failed to fetch remote digest for ${imageTag}`);
            return undefined;
        }
    }

    /**
     * Encapsulates external binary dependencies (Crane).
     * This isolates the "fragile" part of the system.
     */
    private async fetchRemoteCreationDate(
        imageTag: string,
    ): Promise<Date | undefined> {
        try {
            const { stdout } = await execAsync(`crane config ${imageTag}`);
            const { created } = JSON.parse(stdout) as { created?: string };
            return created ? new Date(created) : undefined;
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            logger.warn(
                `'crane' command failed: ${message}. Ensure crane is installed.`,
            );
            return undefined;
        }
    }

    /**
     * Generic wrapper for Dockerode's modem.dial to promisify and type-check it.
     */
    private dockerDial<T>(
        docker: Dockerode,
        options: Parameters<Dockerode['modem']['dial']>[0],
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            docker.modem.dial(options, (error: unknown, data: unknown) => {
                if (error) {
                    reject(
                        error instanceof Error
                            ? error
                            : new Error('Unknown Docker modem error'),
                    );
                    return;
                }
                resolve(data as T);
            });
        });
    }
}
