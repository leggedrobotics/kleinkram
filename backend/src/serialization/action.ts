import { ActionWorkerDto } from '@common/api/types/action-workers.dto';
import { ActionDto } from '@common/api/types/actions/action.dto';
import { AuditLogDto } from '@common/api/types/actions/audit-log.dto';
import { DockerImageDto } from '@common/api/types/actions/docker-image.dto';
import ActionEntity from '@common/entities/action/action.entity';
import { actionTemplateEntityToDto } from './action-template';
import { missionEntityToDto } from './index';
import { userEntityToDto } from './user';

export const actionEntityToDto = (action: ActionEntity): ActionDto => {
    if (action.creator === undefined) {
        throw new Error('Action must have a creator');
    }

    if (action.mission === undefined) {
        throw new Error('Action must have a mission');
    }

    if (action.template === undefined) {
        throw new Error('Action must have a template');
    }

    return {
        artifactUrl: action.artifact_path ?? '',
        artifacts: action.artifacts,
        artifactSize: action.artifact_size,
        artifactFiles: action.artifact_files,
        auditLogs: (action.auditLogs as unknown as AuditLogDto[]) ?? [],
        createdAt: action.createdAt,
        creator: userEntityToDto(action.creator),
        image: (action.image as DockerImageDto) ?? { repoDigests: [] },

        mission: missionEntityToDto(action.mission),
        state: action.state,
        stateCause: action.state_cause ?? '',
        template: actionTemplateEntityToDto(action.template),
        updatedAt: action.updatedAt,
        uuid: action.uuid,
        worker: action.worker as ActionWorkerDto,
    };
};
