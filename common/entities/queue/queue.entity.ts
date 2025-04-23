import { Column, Entity, ManyToOne } from 'typeorm';
import { FileLocation, QueueState } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';

@Entity()
export default class QueueEntity extends BaseEntity {
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
    display_name!: string;

    @Column({
        type: 'enum',
        enum: QueueState,
        default: QueueState.AWAITING_UPLOAD,
    })
    state!: QueueState;

    @ManyToOne(() => Mission, (project) => project.queues, {
        onDelete: 'CASCADE',
    })
    mission?: Mission;

    @Column({
        type: 'enum',
        enum: FileLocation,
        default: FileLocation.MINIO,
    })
    location!: FileLocation;

    @Column({ nullable: true, default: null })
    processingDuration?: number;

    @ManyToOne(() => User, (user) => user.queues)
    creator?: User;
}
