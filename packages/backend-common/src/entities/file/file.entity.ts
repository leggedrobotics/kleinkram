import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import {
    Column,
    Entity,
    Index,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';

@Index('unique_file_name_per_mission', ['filename', 'mission'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'file_entity' })
export class FileEntity extends BaseEntity {
    @ManyToOne(() => MissionEntity, (mission: MissionEntity) => mission.files, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    /**
     * The date the file is sorted and filtered by. It mirrors
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
     * not one was found. It is what lets the backfill rotate through its
     * backlog instead of retrying the same unreadable files forever.
     */
    @Column({ type: 'timestamp', nullable: true })
    recordingTimesCheckedAt?: Date | null;

    @OneToMany(() => TopicEntity, (topic: TopicEntity) => topic.file)
    topics?: TopicEntity[];

    @Column()
    filename!: string;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number.parseInt(value, 10),
        },
    })
    size?: number;

    /**
     * The user who uploaded the file.
     */
    @ManyToOne(() => UserEntity, (user: UserEntity) => user.files, {
        nullable: false,
    })
    creator?: UserEntity;

    @Column({ type: 'enum', enum: FileType })
    type!: FileType;

    @Column({ type: 'enum', enum: FileState, default: FileState.OK })
    state!: FileState;

    @Column({ nullable: true })
    hash?: string;

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

    @Column({ type: 'enum', enum: FileOrigin, nullable: true })
    origin?: FileOrigin;
}
