import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import * as crypto from 'node:crypto';
import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    Index,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { FileVersionEntity } from './file-version.entity';

@Index('unique_file_name_per_mission', ['filename', 'mission'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity()
export class FileEntity extends BaseEntity {
    /**
     * The mission the file belongs to.
     */
    @ManyToOne(() => MissionEntity, (mission: MissionEntity) => mission.files, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    @Column()
    filename!: string;

    /**
     * The user who created the file entry.
     */
    @ManyToOne(() => UserEntity, (user: UserEntity) => user.files, {
        nullable: false,
    })
    creator?: UserEntity;

    /**
     * The active / latest version of the file.
     */
    @ManyToOne(() => FileVersionEntity, {
        nullable: true,
        onDelete: 'SET NULL',
        cascade: ['insert', 'update'],
        eager: true,
    })
    @JoinColumn({ name: 'activeVersionUuid' })
    activeVersion?: FileVersionEntity | null;

    @Column({ type: 'uuid', nullable: true })
    activeVersionUuid?: string | null;

    /**
     * All versions belonging to this file.
     */
    @OneToMany(
        () => FileVersionEntity,
        (fileVersion: FileVersionEntity) => fileVersion.file,
        { cascade: ['insert', 'update'] },
    )
    versions?: FileVersionEntity[];

    @ManyToMany(
        () => CategoryEntity,
        (category: CategoryEntity) => category.files,
    )
    @JoinTable()
    categories?: CategoryEntity[];

    /**
     * The parent file this file was derived from.
     * e.g., If this is a .mcap converted from a .bag, the .bag is the parent.
     */
    @ManyToOne(() => FileEntity, (file: FileEntity) => file.derivedFiles, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    parent?: FileEntity;

    /**
     * Files derived from this file.
     */
    @OneToMany(() => FileEntity, (file: FileEntity) => file.parent)
    derivedFiles?: FileEntity[];

    /**
     * The UUID used for underlying storage (SeaweedFS / S3).
     * For versioned files, this corresponds to activeVersionUuid.
     */
    get storageUuid(): string {
        return this.activeVersionUuid ?? this.uuid;
    }

    // Backwards-compatibility getters & setters proxied to activeVersion
    get size(): number | undefined {
        return this.activeVersion?.size;
    }

    set size(value: number | undefined) {
        this.ensureActiveVersion();
        if (value !== undefined && this.activeVersion) {
            this.activeVersion.size = value;
        }
    }

    get state(): FileState {
        return this.activeVersion?.state ?? FileState.OK;
    }

    set state(value: FileState) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.state = value;
        }
    }

    get type(): FileType {
        return this.activeVersion?.type ?? FileType.BAG;
    }

    set type(value: FileType) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.type = value;
        }
    }

    get hash(): string | undefined {
        return this.activeVersion?.hash;
    }

    set hash(value: string | undefined) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.hash = value;
        }
    }

    get date(): Date {
        return this.activeVersion?.date ?? this.createdAt;
    }

    set date(value: Date) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.date = value;
        }
    }

    get origin(): FileOrigin | undefined {
        return this.activeVersion?.origin ?? undefined;
    }

    set origin(value: FileOrigin | undefined) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.origin = value;
        }
    }

    get recordingStartDate(): Date | null | undefined {
        return this.activeVersion?.recordingStartDate;
    }

    set recordingStartDate(value: Date | null | undefined) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.recordingStartDate = value;
        }
    }

    get recordingEndDate(): Date | null | undefined {
        return this.activeVersion?.recordingEndDate;
    }

    set recordingEndDate(value: Date | null | undefined) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.recordingEndDate = value;
        }
    }

    get recordingTimesCheckedAt(): Date | null | undefined {
        return this.activeVersion?.recordingTimesCheckedAt;
    }

    set recordingTimesCheckedAt(value: Date | null | undefined) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.recordingTimesCheckedAt = value;
        }
    }

    get topics() {
        return this.activeVersion?.topics;
    }

    set topics(value) {
        this.ensureActiveVersion();
        if (this.activeVersion) {
            this.activeVersion.topics = value;
        }
    }

    @BeforeInsert()
    beforeInsert() {
        if (!this.uuid) {
            this.uuid = crypto.randomUUID();
        }
        if (this.activeVersion) {
            if (!this.activeVersion.uuid) {
                this.activeVersion.uuid = crypto.randomUUID();
            }
            this.activeVersionUuid = this.activeVersion.uuid;
            this.activeVersion.file = this;
            this.activeVersion.fileUuid = this.uuid;
            if (!this.versions) {
                this.versions = [this.activeVersion];
            } else if (!this.versions.includes(this.activeVersion)) {
                this.versions.push(this.activeVersion);
            }
        }
    }

    @BeforeUpdate()
    beforeUpdate() {
        if (this.activeVersion) {
            if (!this.activeVersion.uuid) {
                this.activeVersion.uuid = crypto.randomUUID();
            }
            this.activeVersionUuid = this.activeVersion.uuid;
            this.activeVersion.file = this;
            this.activeVersion.fileUuid = this.uuid;
            if (!this.versions) {
                this.versions = [this.activeVersion];
            } else if (!this.versions.includes(this.activeVersion)) {
                this.versions.push(this.activeVersion);
            }
        }
    }

    private ensureActiveVersion(): void {
        if (!this.activeVersion) {
            this.activeVersion = new FileVersionEntity();
            this.activeVersion.uuid = crypto.randomUUID();
            this.activeVersionUuid = this.activeVersion.uuid;
            this.activeVersion.file = this;
            this.activeVersion.versionNumber = 1;
            this.activeVersion.date = new Date();
            this.activeVersion.size = 0;
            this.activeVersion.type = FileType.BAG;
            this.activeVersion.state = FileState.OK;
            if (!this.versions) {
                this.versions = [this.activeVersion];
            } else if (!this.versions.includes(this.activeVersion)) {
                this.versions.push(this.activeVersion);
            }
        }
    }
}
