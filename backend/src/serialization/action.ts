import {
    ActionDto,
    ActionWorkerDto,
    AuditLogDto,
    DockerImageDto,
} from '@kleinkram/api-dto';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { actionTemplateEntityToDto } from './action-template';
import { missionEntityToDto, userEntityToDto } from './index';

const workerEntityToDto = (
    worker: WorkerEntity | null | undefined,
): ActionWorkerDto | null => {
    if (!worker) return null;

    return {
        uuid: worker.uuid,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt,
        identifier: worker.identifier,
        hostname: worker.hostname,
        cpuMemory: worker.cpuMemory,
        gpuModel: worker.gpuModel ?? null,
        gpuMemory: worker.gpuMemory,
        cpuCores: worker.cpuCores,
        cpuModel: worker.cpuModel,
        storage: worker.storage,
        lastSeen: worker.lastSeen,
        reachable: worker.reachable,
    };
};

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

    let runtime: number | undefined;
    if (action.actionContainerStartedAt) {
        const end = action.actionContainerExitedAt
            ? action.actionContainerExitedAt.getTime()
            : Date.now();
        runtime = (end - action.actionContainerStartedAt.getTime()) / 1000;
    }

    return {
        artifactUrl: action.artifact_path ?? '',
        artifacts: action.artifacts,
        artifactSize: action.artifact_size,
        artifactFiles: action.artifact_files,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        auditLogs: (action.auditLogs as unknown as AuditLogDto[]) ?? [],
        createdAt: action.createdAt,
        creator: userEntityToDto(action.creator),
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        image: (action.image as DockerImageDto) ?? { repoDigests: [] },
        runtime,

        mission: missionEntityToDto(action.mission),
        state: action.state,
        stateCause:
            action.state_cause === 'Container exited with code 0'
                ? 'Completed Successfully'
                : (action.state_cause ?? ''),
        template: actionTemplateEntityToDto(action.template),
        updatedAt: action.updatedAt,
        uuid: action.uuid,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        worker: workerEntityToDto(action.worker)!,
        triggerSource: action.triggerSource,
        triggerUuid: action.triggerUuid,
    };
};
