import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { FileEntity } from './file.entity';

@Index('unique_file_version_number', ['fileUuid', 'versionNumber'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'file_version_entity' })
export class FileVersionEntity extends BaseEntity {
    @ManyToOne(() => FileEntity, (file: FileEntity) => file.versions, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'fileUuid' })
    file!: FileEntity;

    @Column({ type: 'uuid' })
    fileUuid!: string;

    @Column({ default: 1 })
    versionNumber!: number;

    /**
     * The date the file version is sorted and filtered by. It mirrors
     * {@link recordingStartDate} as soon as the recording times are known and
     * falls back to the upload time for files we cannot extract a recording
     * start from (e.g. configs). Use {@link recordingStartDate} whenever you
     * need to know whether a date really comes from the recorded data, and
     * `createdAt` for the upload time.
     */
    @Column()
    date!: Date;

    /**
     * Timestamp of the first message in the recording.
     * `null` while unknown (not yet extracted, or not a recording at all).
     */
    @Column({ type: 'timestamp', nullable: true })
    recordingStartDate?: Date | null;

    /**
     * Timestamp of the last message in the recording. Together with
     * {@link recordingStartDate} this gives the wall-clock length of the
     * recording.
     */
    @Column({ type: 'timestamp', nullable: true })
    recordingEndDate?: Date | null;

    /**
     * When the recording window of this file was last looked for, whether or
     * not one was found.
     */
    @Column({ type: 'timestamp', nullable: true })
    recordingTimesCheckedAt?: Date | null;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number.parseInt(value, 10),
        },
    })
    size!: number;

    @Column({ type: 'enum', enum: FileType })
    type!: FileType;

    @Column({ type: 'enum', enum: FileState, default: FileState.OK })
    state!: FileState;

    @Column({ type: 'varchar', nullable: true })
    state_cause?: string | null;

    @Column({ nullable: true })
    hash?: string;

    @Column({ type: 'enum', enum: FileOrigin, nullable: true })
    origin?: FileOrigin;

    @OneToMany(() => TopicEntity, (topic: TopicEntity) => topic.fileVersion)
    topics?: TopicEntity[];
}
