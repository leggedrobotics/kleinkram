import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { loadArchiveConfig } from '@backend-common/modules/archive-storage/archive-config';
import { ProjectArchiveState } from '@kleinkram/shared';
import { ConflictException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere } from 'typeorm';

const stateMessage = (state: ProjectArchiveState): string => {
    const storage = loadArchiveConfig().name;
    switch (state) {
        case ProjectArchiveState.ARCHIVING: {
            return `is being moved to the ${storage} and is read-only`;
        }
        case ProjectArchiveState.ARCHIVED: {
            return `is archived on the ${storage}; restore it to access its files`;
        }
        case ProjectArchiveState.RESTORING: {
            return `is being restored from the ${storage}, try again once the restore finished`;
        }
        default: {
            return 'is available';
        }
    }
};

/**
 * Thrown whenever an operation needs the data of a project that is not in the
 * object storage (or is about to leave it).
 */
export class ProjectArchivedException extends ConflictException {
    constructor(projectName: string, state: ProjectArchiveState) {
        super(`Project "${projectName}" ${stateMessage(state)}.`);
    }
}

export type ArchiveGuardTarget =
    { projectUuid: string } | { missionUuid: string } | { fileUuid: string };

const findProject = async (
    manager: EntityManager,
    target: ArchiveGuardTarget,
): Promise<ProjectEntity | null> => {
    const query = manager
        .createQueryBuilder(ProjectEntity, 'project')
        .select(['project.name', 'project.archiveState']);

    if ('projectUuid' in target) {
        query.where('project.uuid = :uuid', { uuid: target.projectUuid });
    } else if ('missionUuid' in target) {
        query
            .innerJoin(
                MissionEntity,
                'mission',
                'mission.projectUuid = project.uuid',
            )
            .where('mission.uuid = :uuid', { uuid: target.missionUuid });
    } else {
        query
            .innerJoin(
                MissionEntity,
                'mission',
                'mission.projectUuid = project.uuid',
            )
            .innerJoin(FileEntity, 'file', 'file.missionUuid = mission.uuid')
            .where('file.uuid = :uuid', { uuid: target.fileUuid });
    }

    return query.getOne();
};

/**
 * Rejects operations that read or change the data of an archived project:
 * downloads, uploads, moves, deletes and actions. Metadata stays editable.
 */
export async function assertProjectDataAvailable(
    manager: EntityManager,
    target: ArchiveGuardTarget,
): Promise<void> {
    const project = await findProject(manager, target);
    // Unknown targets are left to the caller, which reports a proper 404.
    if (!project) return;
    if (project.archiveState !== ProjectArchiveState.ACTIVE) {
        throw new ProjectArchivedException(project.name, project.archiveState);
    }
}

/**
 * Whether the data of the target is in the object storage. Background jobs
 * use it to skip files of archived projects instead of failing on (or, worse,
 * "repairing") objects that were moved to the archive storage on purpose.
 */
export async function isProjectDataAvailable(
    manager: EntityManager,
    target: ArchiveGuardTarget,
): Promise<boolean> {
    const project = await findProject(manager, target);
    return project?.archiveState === ProjectArchiveState.ACTIVE;
}

/**
 * `where` condition for file queries that restricts them to files whose data
 * is in the object storage, i.e. not in an archived (or archiving, restoring)
 * project. Every maintenance job that reads objects has to use it.
 */
export const fileDataInObjectStorage = (): FindOptionsWhere<FileEntity> => ({
    mission: { project: { archiveState: ProjectArchiveState.ACTIVE } },
});
