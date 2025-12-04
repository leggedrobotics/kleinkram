import FileEntity from '@backend-common/entities/file/file.entity';
import MissionEntity from '@backend-common/entities/mission/mission.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { FileEventType } from '@kleinkram/shared';
import { Column, CreateDateColumn, Entity, Index, ManyToOne } from 'typeorm';

@Entity({ name: 'file_event' })
export default class FileEventEntity {
    @Column({ primary: true, generated: 'uuid' })
    uuid!: string;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt!: Date;

    @Column({
        type: 'enum',
        enum: FileEventType,
    })
    type!: FileEventType;

    /**
     * JSON payload for specific details.
     * e.g. { oldName: "foo.bag", newName: "bar.bag" } or { error: "Corrupted header" }
     */
    @Column({ type: 'jsonb', default: {} })
    details!: Record<string, any>;

    /**
     * Snapshot of the filename at the time of the event.
     * Useful if the FileEntity is deleted later.
     */
    @Column()
    filenameSnapshot!: string;

    @ManyToOne(() => UserEntity, { nullable: true })
    actor?: UserEntity;

    /**
     * Relation to the file.
     * CHANGED: onDelete set to CASCADE to delete this event if the file is deleted.
     */
    @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'CASCADE' })
    file?: FileEntity;

    /**
     * Relation to Mission. Useful for filtering logs by mission
     * even if the file is gone.
     */
    @ManyToOne(() => MissionEntity, { nullable: true, onDelete: 'CASCADE' })
    @Index()
    mission?: MissionEntity;

    @ManyToOne('ActionEntity', { nullable: true, onDelete: 'CASCADE' })
    action?: any;
}
