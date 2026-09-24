import { ActionEntity, environment } from '@kleinkram/backend-common';
import { ActionDiagnosticEntity } from '@kleinkram/backend-common/entities/action/action-diagnostic.entity';
import {
    ACTION_DIAGNOSTIC_LIMIT,
    ActionSeverity,
    ArtifactState,
    DiagnosticSeverity,
    severitiesBelow,
} from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sanitizeStateComment } from '../../file-processor/helper/state-comment';
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
        @InjectRepository(ActionDiagnosticEntity)
        private diagnosticRepository: Repository<ActionDiagnosticEntity>,
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
            uploaderStderr,
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
            // Reporting is best effort: a failed write here must not turn a
            // finished run into a system failure in the action manager.
            await this.reportUploadFailure(
                actionUuid,
                exitCode,
                uploaderStderr,
            ).catch((error: unknown) => {
                logger.error(
                    `Failed to record the artifact upload failure for action ${actionUuid}: ${String(error)}`,
                );
            });
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

    /**
     * Records a failed upload as a warning on the action, with the uploader's
     * last error line, so that the cause shows up in the action's diagnostics
     * instead of only in the queue consumer's debug log.
     */
    private async reportUploadFailure(
        actionUuid: string,
        exitCode: number,
        uploaderStderr: string,
    ): Promise<void> {
        // A Python traceback ends with the exception, which names the cause.
        const lastLine = uploaderStderr.trim().split(/\r?\n/).pop() ?? '';
        const detail = sanitizeStateComment(lastLine);
        const message = sanitizeStateComment(
            detail
                ? `Artifact upload failed: ${detail}`
                : `Artifact upload failed (uploader exit code ${String(exitCode)})`,
        );

        // Same limit as ActionDiagnosticService.record.
        const action = await this.actionRepository.findOne({
            where: { uuid: actionUuid },
            select: { uuid: true, diagnosticCount: true },
        });
        if ((action?.diagnosticCount ?? 0) >= ACTION_DIAGNOSTIC_LIMIT) {
            await this.actionRepository.update(
                { uuid: actionUuid },
                { diagnosticsTruncated: true },
            );
        } else {
            await this.diagnosticRepository.save(
                this.diagnosticRepository.create({
                    actionUuid,
                    severity: DiagnosticSeverity.WARNING,
                    code: 'ARTIFACT_UPLOAD_FAILED',
                    message,
                    count: 1,
                }),
            );
            await this.actionRepository.increment(
                { uuid: actionUuid },
                'diagnosticCount',
                1,
            );
        }
        await this.actionRepository
            .createQueryBuilder()
            .update(ActionEntity)
            .set({ severity: ActionSeverity.WARNING })
            .where('uuid = :uuid', { uuid: actionUuid })
            .andWhere('severity IN (:...overwritable)', {
                overwritable: severitiesBelow(ActionSeverity.WARNING),
            })
            .execute();
    }
}
