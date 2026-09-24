import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { ProjectArchiveJobState } from '@kleinkram/shared';
import { Column, Entity, ManyToOne } from 'typeorm';

/** One file inside a tar part, as written to `manifest.json`. */
export interface ArchivedFileEntry {
    fileUuid: string;
    missionUuid: string;
    filename: string;
    /** Path of the entry inside the tar part. */
    path: string;
    size: number;
    /** base64 MD5, the same format as `FileEntity.hash`. */
    md5: string;
    sha256: string;
}

/** One packed object on the long term storage. */
export interface ArchivePart {
    name: string;
    size: number;
    sha256: string;
    files: ArchivedFileEntry[];
}

const bigintTransformer = {
    to: (value: number): number => value,
    from: (value: string | null): number =>
        value === null ? 0 : Number.parseInt(value, 10),
};

/**
 * A copy of all files of a project on the long term storage (ETH LTS).
 *
 * The parts are write-once: once the storage sealed them they can only be
 * deleted, never changed. The record is kept after a restore so that an
 * unchanged project can be archived again without writing a second copy.
 */
@Entity({ name: 'project_archive' })
export class ProjectArchiveEntity extends BaseEntity {
    @ManyToOne(() => ProjectEntity, (project) => project.archives, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    project?: ProjectEntity | null;

    /**
     * Name of the project at archive time, kept in case the project is
     * deleted while its copy remains on the long term storage.
     */
    @Column()
    projectName!: string;

    @Column({
        type: 'enum',
        enum: ProjectArchiveJobState,
        default: ProjectArchiveJobState.QUEUED,
    })
    state!: ProjectArchiveJobState;

    /** Directory of the archive, relative to the long term storage root. */
    @Column()
    location!: string;

    @Column({ type: 'jsonb', default: [] })
    parts!: ArchivePart[];

    @Column({ default: 0 })
    fileCount!: number;

    @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
    totalBytes!: number;

    /** Bytes handled by the running phase, drives the progress bars. */
    @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
    bytesProcessed!: number;

    @Column({ type: 'text', nullable: true })
    reason?: string | null;

    @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
    requestedBy?: UserEntity | null;

    @Column({ type: 'timestamp', nullable: true })
    archivedAt?: Date | null;

    @Column({ type: 'text', nullable: true })
    restoreReason?: string | null;

    @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
    restoreRequestedBy?: UserEntity | null;

    @Column({ type: 'timestamp', nullable: true })
    restoreRequestedAt?: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    restoredAt?: Date | null;

    @Column({ type: 'text', nullable: true })
    error?: string | null;
}
