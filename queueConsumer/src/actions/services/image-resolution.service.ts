import { ImageSource } from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import logger from '../../logger';

export interface ImageResolutionResult {
    source: ImageSource;
    localCreatedAt: Date | undefined;
    remoteCreatedAt: Date | undefined;
    shouldPull: boolean;
}

@Injectable()
export class ImageResolutionService {
    async resolveImage(
        docker: Dockerode,
        dockerImage: string,
    ): Promise<ImageResolutionResult> {
        let source: ImageSource = ImageSource.LOCALLY_BUILT;
        let remoteCreatedAt: Date | undefined;
        let shouldPull = false;

        const { localCreatedAt: localCreated, localRepoDigests } =
            await this.getLocalImageDetails(docker, dockerImage);
        const localCreatedAt = localCreated;

        try {
            const remoteDigest = await this.getRemoteImageDigest(
                docker,
                dockerImage,
            );

            logger.debug(
                `Local RepoDigests: ${localRepoDigests.join(', ')}. Remote Digest: ${remoteDigest}`,
            );

            const result = this.determineImageSource(
                localCreatedAt,
                localRepoDigests,
                remoteDigest,
            );
            source = result.source;
            shouldPull = result.shouldPull;
            remoteCreatedAt = result.remoteCreatedAt;
        } catch (error) {
            logger.warn(
                `Failed to check remote image: ${error}. Falling back to local if available.`,
            );
            if (localCreatedAt) {
                // Fallback to local
                source = ImageSource.LOCALLY_BUILT;
            } else {
                // Local does not exist and remote check failed. Try to pull anyway as a last resort
                source = ImageSource.PULLED;
                shouldPull = true;
            }
        }

        return { source, localCreatedAt, remoteCreatedAt, shouldPull };
    }

    private async getLocalImageDetails(
        docker: Dockerode,
        dockerImage: string,
    ): Promise<{ localCreatedAt?: Date; localRepoDigests: string[] }> {
        try {
            const image = docker.getImage(dockerImage);
            const localDetails = await image.inspect();
            return {
                localCreatedAt: new Date(localDetails.Created),
                localRepoDigests: localDetails.RepoDigests || [],
            };
        } catch {
            return { localRepoDigests: [] };
        }
    }

    private async getRemoteImageDigest(
        docker: Dockerode,
        dockerImage: string,
    ): Promise<string | undefined> {
        // Use Docker Engine API to get distribution info (manifest digest)
        // This avoids using the docker CLI and works with the existing dockerode connection
        const distributionInspect = await new Promise<any>(
            (resolve, reject) => {
                const options = {
                    path: `/distribution/${dockerImage}/json`,
                    method: 'GET',
                    statusCodes: {
                        200: true,
                        401: true,
                        403: true,
                        500: false,
                    },
                };
                docker.modem.dial(options, (error, data) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(data);
                });
            },
        );

        return distributionInspect.Descriptor?.digest;
    }

    private determineImageSource(
        localCreatedAt: Date | undefined,
        localRepoDigests: string[],
        remoteDigest: string | undefined,
    ): {
        source: ImageSource;
        shouldPull: boolean;
        remoteCreatedAt: Date | undefined;
    } {
        if (
            remoteDigest &&
            localRepoDigests.some((digest) => digest.includes(remoteDigest))
        ) {
            logger.info(
                `Local image RepoDigest matches remote digest. Using cached.`,
            );
            // Since we can't easily get remote creation date without pulling or complex registry API calls,
            // we'll assume it's the same as local if cached.
            return {
                source: ImageSource.CACHED,
                shouldPull: false,
                remoteCreatedAt: localCreatedAt,
            };
        }

        // Mismatch or remote check failed to get digest
        if (localCreatedAt) {
            // Local exists but digest mismatches.
            // We can't easily check if remote is newer without creation date.
            // Default to LOCALLY_BUILT to prefer local changes.
            logger.info(
                `Local image exists but digest mismatches or remote date unknown. Using local.`,
            );
            return {
                source: ImageSource.LOCALLY_BUILT,
                shouldPull: false,
                remoteCreatedAt: undefined,
            };
        }

        // Local does not exist, must pull
        logger.info(`Local image does not exist. Pulling...`);
        return {
            source: ImageSource.PULLED,
            shouldPull: true,
            remoteCreatedAt: undefined,
        };
    }
}
