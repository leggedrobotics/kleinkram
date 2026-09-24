import {
    ArchivePreflightDto,
    ProjectArchiveDto,
    ProjectArchiveStatusDto,
} from '@kleinkram/api-dto';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectArchiveEntity } from '@kleinkram/backend-common/entities/project/project-archive.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import environment from '@kleinkram/backend-common/environment';
import {
    loadArchiveConfig,
    renderRestoreInstructions,
} from '@kleinkram/backend-common/modules/archive-storage/archive-config';
import {
    ARCHIVE_QUEUE,
    planArchiveParts,
} from '@kleinkram/backend-common/modules/archive-storage/archive-storage';
import {
    FileState,
    ProjectArchiveJobState,
    ProjectArchiveState,
    TERMINAL_ACTION_STATES,
} from '@kleinkram/shared';
import {
    ConflictException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Queue from 'bull';
import { DataSource, In, Not, Repository } from 'typeorm';
import logger from '../logger';

/** Files that are still being written or converted. */
const BUSY_FILE_STATES = new Set([FileState.UPLOADING, FileState.CONVERTING]);

@Injectable()
export class ProjectArchiveService implements OnModuleInit {
    private archiveQueue!: Queue.Queue;

    constructor(
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(ProjectArchiveEntity)
        private readonly archiveRepository: Repository<ProjectArchiveEntity>,
        private readonly dataSource: DataSource,
    ) {}

    onModuleInit(): void {
        this.archiveQueue = new Queue(ARCHIVE_QUEUE, { redis });
    }

    async getStatus(projectUuid: string): Promise<ProjectArchiveStatusDto> {
        const project = await this.findProject(projectUuid);
        const archives = await this.archiveRepository.find({
            where: { project: { uuid: projectUuid } },
            relations: { requestedBy: true, restoreRequestedBy: true },
            order: { createdAt: 'DESC' },
        });
        const current = archives.at(0) ?? null;

        const config = loadArchiveConfig();
        const enabled = environment.ARCHIVE_ENABLED;

        return {
            storage: {
                enabled,
                name: config.name,
                description: config.description ?? null,
                links: config.links,
                costPerTbYear: config.costPerTbYear ?? null,
                currency: config.currency,
            },
            archiveState: project.archiveState,
            current: current ? this.toDto(current) : null,
            history: archives.map((archive) => this.toDto(archive)),
            restoreInstructions: current
                ? renderRestoreInstructions({
                      projectName: current.projectName,
                      projectUuid: project.uuid,
                      archiveUuid: current.uuid,
                      location: current.location,
                      parts: current.parts.map((part) => part.name),
                  })
                : null,
            preflight:
                enabled && project.archiveState === ProjectArchiveState.ACTIVE
                    ? await this.preflight(project, current)
                    : null,
        };
    }

    async requestArchive(
        projectUuid: string,
        user: UserEntity,
        reason?: string,
    ): Promise<ProjectArchiveStatusDto> {
        this.assertEnabled();
        const archive = await this.dataSource.transaction(async (manager) => {
            // Lock the project row so that two requests cannot both pass
            const project = await manager.findOne(ProjectEntity, {
                where: { uuid: projectUuid },
                lock: { mode: 'pessimistic_write' },
            });
            if (!project) throw new NotFoundException('Project not found');
            if (project.archiveState !== ProjectArchiveState.ACTIVE) {
                throw new ConflictException(
                    `Project is ${project.archiveState.toLowerCase()}`,
                );
            }

            const previous = await manager.findOne(ProjectArchiveEntity, {
                where: { project: { uuid: projectUuid } },
                order: { createdAt: 'DESC' },
            });
            const preflight = await this.preflight(project, previous, manager);
            if (preflight.blockers.length > 0) {
                throw new ConflictException(preflight.blockers.join(' '));
            }

            project.archiveState = ProjectArchiveState.ARCHIVING;
            await manager.save(project);

            if (preflight.reusesPreviousArchive && previous) {
                // The copy on the archive storage is still valid, only drop S3
                previous.state = ProjectArchiveJobState.AWAITING_SEAL;
                previous.reason = reason ?? previous.reason ?? null;
                previous.requestedBy = user;
                previous.error = null;
                return manager.save(previous);
            }

            const created = manager.create(ProjectArchiveEntity, {
                project,
                projectName: project.name,
                state: ProjectArchiveJobState.QUEUED,
                location: '',
                parts: [],
                fileCount: preflight.fileCount,
                totalBytes: preflight.totalBytes,
                reason: reason ?? null,
                requestedBy: user,
            });
            const saved = await manager.save(created);
            saved.location = `kleinkram/${project.uuid}/${saved.uuid}`;
            return manager.save(saved);
        });

        await this.archiveQueue.add(
            archive.state === ProjectArchiveJobState.QUEUED
                ? 'archive-project'
                : 'await-seal',
            { archiveUuid: archive.uuid },
            { jobId: `archive-${archive.uuid}-${Date.now().toString()}` },
        );
        logger.info(
            `Archive ${archive.uuid} of project ${projectUuid} requested by ${user.uuid}`,
        );
        return this.getStatus(projectUuid);
    }

    async requestRestore(
        projectUuid: string,
        user: UserEntity,
        reason: string,
    ): Promise<ProjectArchiveStatusDto> {
        this.assertEnabled();
        const archive = await this.dataSource.transaction(async (manager) => {
            const project = await manager.findOne(ProjectEntity, {
                where: { uuid: projectUuid },
                lock: { mode: 'pessimistic_write' },
            });
            if (!project) throw new NotFoundException('Project not found');
            if (project.archiveState !== ProjectArchiveState.ARCHIVED) {
                throw new ConflictException(
                    `Only archived projects can be restored, this one is ${project.archiveState.toLowerCase()}`,
                );
            }
            const current = await manager.findOneOrFail(ProjectArchiveEntity, {
                where: {
                    project: { uuid: projectUuid },
                    state: In([
                        ProjectArchiveJobState.ARCHIVED,
                        ProjectArchiveJobState.FAILED,
                    ]),
                },
                order: { createdAt: 'DESC' },
            });

            project.archiveState = ProjectArchiveState.RESTORING;
            await manager.save(project);

            current.state = ProjectArchiveJobState.RECALLING;
            current.bytesProcessed = 0;
            current.error = null;
            current.restoreReason = reason;
            current.restoreRequestedBy = user;
            current.restoreRequestedAt = new Date();
            current.restoredAt = null;
            return manager.save(current);
        });

        await this.archiveQueue.add(
            'restore-project',
            { archiveUuid: archive.uuid },
            { jobId: `restore-${archive.uuid}-${Date.now().toString()}` },
        );
        logger.info(
            `Restore of archive ${archive.uuid} (project ${projectUuid}) requested by ${user.uuid}`,
        );
        return this.getStatus(projectUuid);
    }

    /** Archiving is opt-in per deployment, see ARCHIVE_ENABLED. */
    private assertEnabled(): void {
        if (!environment.ARCHIVE_ENABLED) {
            throw new NotFoundException(
                'Archiving projects is not enabled on this instance',
            );
        }
    }

    private async findProject(uuid: string): Promise<ProjectEntity> {
        const project = await this.projectRepository.findOne({
            where: { uuid },
        });
        if (!project) throw new NotFoundException('Project not found');
        return project;
    }

    private async preflight(
        project: ProjectEntity,
        previous: ProjectArchiveEntity | null,
        manager = this.dataSource.manager,
    ): Promise<ArchivePreflightDto> {
        const files = await manager.find(FileEntity, {
            where: { mission: { project: { uuid: project.uuid } } },
            select: { uuid: true, size: true, hash: true, state: true },
        });
        const missionCount = await manager.count(MissionEntity, {
            where: { project: { uuid: project.uuid } },
        });
        const runningActions = await manager.count(ActionEntity, {
            where: {
                mission: { project: { uuid: project.uuid } },
                state: Not(In([...TERMINAL_ACTION_STATES])),
            },
        });

        const blockers: string[] = [];
        if (files.length === 0) {
            blockers.push('The project has no files to archive.');
        }
        const busy = files.filter((file) =>
            BUSY_FILE_STATES.has(file.state),
        ).length;
        if (busy > 0) {
            blockers.push(
                `${busy.toString()} file(s) are still uploading or converting.`,
            );
        }
        if (runningActions > 0) {
            blockers.push(
                `${runningActions.toString()} action(s) are still running.`,
            );
        }

        const costPerTbYear = loadArchiveConfig().costPerTbYear;
        const sizes = files.map((file) => ({ size: file.size ?? 0 }));
        const totalBytes = sizes.reduce((sum, file) => sum + file.size, 0);

        return {
            missionCount,
            fileCount: files.length,
            totalBytes,
            estimatedParts: planArchiveParts(sizes).length,
            estimatedYearlyCost:
                costPerTbYear === undefined
                    ? null
                    : Math.round((totalBytes / 1e12) * costPerTbYear * 100) /
                      100,
            reusesPreviousArchive: this.isUnchangedSince(previous, files),
            blockers,
        };
    }

    /**
     * Whether the files are exactly those of an archive that was restored
     * before, so that archiving again only has to drop the S3 copy.
     */
    private isUnchangedSince(
        previous: ProjectArchiveEntity | null,
        files: FileEntity[],
    ): boolean {
        if (previous?.state !== ProjectArchiveJobState.RESTORED) return false;
        const archived = new Map(
            previous.parts
                .flatMap((part) => part.files)
                .map((entry) => [entry.fileUuid, entry.md5]),
        );
        return (
            archived.size === files.length &&
            files.every(
                (file) =>
                    file.hash !== undefined &&
                    archived.get(file.uuid) === file.hash,
            )
        );
    }

    private toDto(archive: ProjectArchiveEntity): ProjectArchiveDto {
        return {
            uuid: archive.uuid,
            state: archive.state,
            location: archive.location,
            parts: archive.parts.map((part) => ({
                name: part.name,
                size: part.size,
                sha256: part.sha256,
                fileCount: part.files.length,
            })),
            fileCount: archive.fileCount,
            totalBytes: archive.totalBytes,
            bytesProcessed: archive.bytesProcessed,
            reason: archive.reason ?? null,
            requestedBy: archive.requestedBy?.name ?? null,
            createdAt: archive.createdAt,
            archivedAt: archive.archivedAt ?? null,
            restoreReason: archive.restoreReason ?? null,
            restoreRequestedBy: archive.restoreRequestedBy?.name ?? null,
            restoreRequestedAt: archive.restoreRequestedAt ?? null,
            restoredAt: archive.restoredAt ?? null,
            error: archive.error ?? null,
        };
    }
}
