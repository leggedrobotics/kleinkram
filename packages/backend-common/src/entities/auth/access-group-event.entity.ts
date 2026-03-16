import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupEventType } from '@kleinkram/shared';
import { Column, CreateDateColumn, Entity, Index, ManyToOne } from 'typeorm';

@Entity({ name: 'access_group_event' })
export class AccessGroupEventEntity {
    @Column({ primary: true, generated: 'uuid' })
    uuid!: string;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt!: Date;

    @Column({
        type: 'enum',
        enum: AccessGroupEventType,
    })
    type!: AccessGroupEventType;

    /**
     * JSON payload for specific details.
     * e.g. { projectUuid: "...", projectName: "...", rights: 10 }
     */
    @Column({ type: 'jsonb', default: {} })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details!: Record<string, any>;

    @ManyToOne(() => UserEntity, { nullable: true })
    actor?: UserEntity;

    @ManyToOne(() => AccessGroupEntity, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @Index()
    accessGroup!: AccessGroupEntity;
}
