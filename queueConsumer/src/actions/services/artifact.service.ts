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
 * Encapsulates the artifact upload container logic and MinIO path management.
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

        await artifactUploadContainer.wait();
        this.dockerDaemon.removeContainer(artifactUploadContainer.id);

        await this.dockerDaemon.removeVolume(`${runnerId}-${actionUuid}`);

        const bucketName = environment.MINIO_ARTIFACTS_BUCKET_NAME;
        const filename = `${actionUuid}.tar.gz`;
        const artifactPath = `/${bucketName}/${filename}`;

        const updateData: {
            artifacts: ArtifactState;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            artifact_path: string;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            artifact_size?: number;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            artifact_files?: string[];
        } = {
            artifacts: ArtifactState.UPLOADED,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            artifact_path: artifactPath,
        };

        if (artifactMetadata?.size !== undefined) {
            updateData.artifact_size = artifactMetadata.size;
        }
        if (artifactMetadata?.files !== undefined) {
            updateData.artifact_files = artifactMetadata.files;
        }

        await this.actionRepository.update({ uuid: actionUuid }, updateData);

        logger.debug(`Artifacts uploaded for action ${actionUuid}`);

        return {
            artifactPath,
            artifactSize: artifactMetadata?.size,
            artifactFiles: artifactMetadata?.files,
            containerLimits,
            volumeName,
        };
    }
}
