import { ActionEntity, environment } from '@kleinkram/backend-common';
import { ArtifactState } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { tracing } from '../../tracing';
import { ContainerLimits, DockerDaemon } from './docker-daemon.service';

/**
 * Service for handling artifact uploads after action completion.
 * Encapsulates the artifact upload container logic and s3 path management.
 */
@Injectable()
export class ArtifactService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        private readonly dockerDaemon: DockerDaemon,
    ) {}

    /**
     * Upload artifacts for a completed action.
     * Launches the artifact uploader container, waits for completion,
     * and updates the action entity with artifact metadata.
     *
     * @param actionUuid The UUID of the action to upload artifacts for.
     */
    @tracing()
    async uploadArtifacts(
        actionUuid: string,
        runnerId: string,
    ): Promise<{
        artifactPath: string;
        artifactSize?: number;
        artifactFiles?: string[];
        containerLimits: ContainerLimits;
        volumeName: string;
    }> {
        // Mark as uploading
        await this.actionRepository.update(
            { uuid: actionUuid },
            { artifacts: ArtifactState.UPLOADING },
        );

        const {
            container: artifactUploadContainer,
            artifactMetadata,
            containerLimits,
            volumeName,
        } = await this.dockerDaemon.launchArtifactUploadContainer(
            actionUuid,
            runnerId,
        );

        const { StatusCode: exitCode } =
            (await artifactUploadContainer.wait()) as {
                StatusCode: number;
            };
        this.dockerDaemon.removeContainer(artifactUploadContainer.id);

        await this.dockerDaemon.removeArtifactVolume(runnerId, actionUuid);

        // The uploader prints ARTIFACT_METADATA only after the object is in
        // the bucket. Without it there is nothing to download, so do not
        // point the action at a key that was never written.
        if (exitCode !== 0 || artifactMetadata === undefined) {
            logger.error(
                `Artifact upload failed for action ${actionUuid} (uploader exit code ${String(exitCode)})`,
            );
            await this.actionRepository.update(
                { uuid: actionUuid },
                { artifacts: ArtifactState.ERROR },
            );
            return { artifactPath: '', containerLimits, volumeName };
        }

        const bucketName = environment.S3_ARTIFACTS_BUCKET_NAME;
        const filename = `${actionUuid}.tar.gz`;
        const artifactPath = `/${bucketName}/${filename}`;

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 90);

        await this.actionRepository.update(
            { uuid: actionUuid },
            {
                artifacts: ArtifactState.UPLOADED,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_path: artifactPath,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_size: artifactMetadata.size,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                artifact_files: artifactMetadata.files,
                artifactExpirationDate: expirationDate,
            },
        );

        logger.debug(`Artifacts uploaded for action ${actionUuid}`);

        return {
            artifactPath,
            artifactSize: artifactMetadata.size,
            artifactFiles: artifactMetadata.files,
            containerLimits,
            volumeName,
        };
    }
}
