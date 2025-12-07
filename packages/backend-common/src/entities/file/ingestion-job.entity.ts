import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileLocation, QueueState } from '@kleinkram/shared';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity({ name: 'ingestion_job' })
export class IngestionJobEntity extends BaseEntity {
    /**
     * The unique identifier of the file.
     *
     * This is the Google Drive ID for files imported from Google Drive or
     * the UUID for file entities created in the system for files uploaded.
     *
     */
    @Column()
    identifier!: string;

    /**
     * The name of the file as displayed to the user in the queue list
     *
     */
    @Column({ default: '' })

    // eslint-disable-next-line @typescript-eslint/naming-convention
    display_name!: string;

    @Column({
        type: 'enum',
        enum: QueueState,
        default: QueueState.AWAITING_UPLOAD,
    })
    state!: QueueState;

    @ManyToOne(() => MissionEntity, (project) => project.ingestionJobs, {
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    @Column({
        type: 'enum',
        enum: FileLocation,
        default: FileLocation.MINIO,
    })
    location!: FileLocation;

    @Column({ nullable: true, default: null })
    processingDuration?: number;

    /**
     * Error message if the ingestion failed.
     */
    @Column({ nullable: true, default: null })
    errorMessage?: string;

    @ManyToOne(() => UserEntity, (user) => user.queues)
    creator?: UserEntity;

    /**
     * Link to the actual FileEntity once created.
     * This allows us to easily join Queue -> File.
     * CHANGED: onDelete set to CASCADE to delete this job if the file is deleted.
     */
    @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'file_uuid' })
    file?: FileEntity;
}
