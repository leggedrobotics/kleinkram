import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { ActionState, ArtifactState } from '../../frontend_shared/enum';
import { RuntimeDescription } from '../../types';
import Apikey from '../auth/apikey.entity';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import Worker from '../worker/worker.entity';
import ActionTemplate from './action-template.entity';

export interface ContainerLog {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
}

export interface Image {
    sha: string | null;
    repoDigests: string[] | null;
}

export interface Container {
    id: string;
}

export interface SubmittedAction {
    uuid: string;
    state: ActionState;

    runtime_requirements: RuntimeDescription;
    image: Image;
    command: string;
}

@Entity()
export default class Action extends BaseEntity {
    @Column()
    state!: ActionState;

    @Column({ type: 'json', nullable: true })
    container?: Container;

    @ManyToOne(() => User, (user) => user.submittedActions, { nullable: false })
    createdBy?: User;

    @Column({ nullable: true })
    state_cause?: string;

    @Column({ nullable: true })
    executionStartedAt?: Date;

    @Column({ nullable: true })
    executionEndedAt?: Date;

    @ManyToOne(() => Mission, (mission) => mission.actions, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    mission?: Mission;

    @Column({ type: 'json', nullable: true })
    logs?: ContainerLog[];

    @Column({ type: 'json', nullable: true, default: [] })
    auditLogs?: any[];

    @Column({ nullable: true })
    exit_code?: number;

    @Column({ nullable: true })
    artifact_url?: string;

    @Column({ nullable: false, default: ArtifactState.AWAITING_ACTION })
    artifacts!: ArtifactState;

    @OneToOne(() => Apikey, (apikey) => apikey.action)
    @JoinColumn()
    key?: Apikey;

    @ManyToOne(
        () => ActionTemplate,
        (actionTemplate) => actionTemplate.actions,
        { nullable: false },
    )
    template?: ActionTemplate;

    @Column({ type: 'json', nullable: true })
    image?: Image;

    @ManyToOne(() => Worker, (worker) => worker.actions, { nullable: true })
    worker?: Worker;
}
