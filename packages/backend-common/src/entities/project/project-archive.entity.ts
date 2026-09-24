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

/** One packed object on the archive storage. */
export interface ArchivePart {
    name: string;
    size: number;
    sha256: string;
    files: ArchivedFileEntry[];
}

/** One file as planned into a part, before it is written. */
export interface PlannedFile {
    fileUuid: string;
    size: number;
    /** Path of the entry inside the tar part, fixed at planning time. */
    path: string;
}

/**
 * The layout of an archive, decided once before the first byte is written so
 * that a resumed run writes exactly the same parts.
 */
export interface PlannedPart {
    name: string;
    files: PlannedFile[];
}

const bigintTransformer = {
    to: (value: number): number => value,
    from: (value: string | null): number =>
        value === null ? 0 : Number.parseInt(value, 10),
};

/**
 * A copy of all files of a project on the archive storage.
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
     * deleted while its copy remains on the archive storage.
     */
    @Column()
    projectName!: string;

    @Column({
        type: 'enum',
        enum: ProjectArchiveJobState,
        default: ProjectArchiveJobState.QUEUED,
    })
    state!: ProjectArchiveJobState;

    /** Directory of the archive, relative to the archive storage root. */
    @Column()
    location!: string;

    /** Layout of the archive, see {@link PlannedPart}. */
    @Column({ type: 'jsonb', default: [] })
    plan!: PlannedPart[];

    /** Parts written and checksummed so far, in the order of the plan. */
    @Column({ type: 'jsonb', default: [] })
    parts!: ArchivePart[];

    /**
     * Runs that worked on the current phase, the running one included. A
     * phase that keeps failing, or keeps killing the consumer, gives up after
     * ARCHIVE_MAX_ATTEMPTS of them.
     */
    @Column({ default: 0 })
    attempts!: number;

    /** Parts restored so far, so that a resumed restore skips them. */
    @Column({ default: 0 })
    partsDone!: number;

    /**
     * Which queue consumer works on the archive, and until when. The lease
     * is renewed while it works and simply expires if the consumer dies, so
     * another one can take over; two consumers never work on one archive.
     */
    @Column({ type: 'varchar', nullable: true })
    leaseOwner?: string | null;

    @Column({ type: 'timestamp', nullable: true })
    leaseUntil?: Date | null;

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
