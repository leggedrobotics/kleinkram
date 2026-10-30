import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { ActionState, StateCauseParams } from '@kleinkram/shared';
import { Column, CreateDateColumn, Entity, Index, ManyToOne } from 'typeorm';

/**
 * One change of an action's state, and why it happened.
 *
 * Rows are only ever appended, by `transitionAction`; together they are the
 * timeline shown on the action page. The action itself keeps a copy of the
 * latest state and cause so that lists can filter without a join.
 */
@Index('idx_action_state_transition_action', ['actionUuid', 'createdAt'])
@Entity({ name: 'action_state_transition' })
export class ActionStateTransitionEntity {
    @Column({ primary: true, generated: 'uuid' })
    uuid!: string;

    @CreateDateColumn({
        type: 'timestamptz',
        // clock_timestamp, not now(): two changes in one transaction must
        // still sort in the order they happened.
        default: () => 'clock_timestamp()',
    })
    createdAt!: Date;

    @Column({ type: 'enum', enum: ActionState })
    state!: ActionState;

    /**
     * An {@link ActionStateCause}, kept as text: a newer service may write a
     * code this one does not know yet.
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    causeCode?: string | null;

    @Column({ type: 'jsonb', nullable: true })
    causeParams?: StateCauseParams | null;

    /** Raw text of an external error, shown as-is and never parsed. */
    @Column({ type: 'text', nullable: true })
    message?: string | null;

    @ManyToOne(() => ActionEntity, (action) => action.stateTransitions, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    action?: ActionEntity;

    @Column({ type: 'uuid' })
    actionUuid!: string;

    /** Who caused the change, e.g. who cancelled. Kept when the user is not. */
    @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
    actor?: UserEntity | null;

    @Column({ type: 'uuid', nullable: true })
    actorUuid?: string | null;
}
