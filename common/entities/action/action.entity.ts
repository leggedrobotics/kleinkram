import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import Apikey from '../auth/apikey.entity';
import { ActionState, ArtifactState } from '../../enum';
import User from '../user/user.entity';
import ActionTemplate from './actionTemplate.entity';
import Worker from '../worker/worker.entity';
import { RuntimeDescription } from '../../types';

export type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export type Image = {
    sha: string | null;
    repoDigests: string[] | null;
};

export type Container = {
    id: string;
};

export interface SubmittedAction {
    uuid: string;
    state: ActionState;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    runtime_requirements: RuntimeDescription;
    image: Image;
    command: string;
}

@Entity()
export default class Action extends BaseEntity {
    @Column()
    state: ActionState;

    @Column({ type: 'json', nullable: true })
    container: Container;

    @ManyToOne(() => User, (user) => user.submittedActions)
    createdBy: User;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    state_cause: string;

    @Column({ nullable: true })
    executionStartedAt: Date;

    @Column({ nullable: true })
    executionEndedAt: Date;

    @ManyToOne(() => Mission, (mission) => mission.actions, {
        onDelete: 'CASCADE',
    })
    mission: Mission;

    @Column({ type: 'json', nullable: true })
    logs: ContainerLog[];

    @Column({ type: 'json', nullable: true, default: [] })
    auditLogs: any;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    exit_code: number;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    artifact_url: string;

    @Column({ nullable: false, default: ArtifactState.AWAITING_ACTION })
    artifacts: ArtifactState;

    @OneToOne(() => Apikey, (apikey) => apikey.action)
    @JoinColumn()
    key: Apikey;

    @ManyToOne(() => ActionTemplate, (actionTemplate) => actionTemplate.actions)
    template: ActionTemplate;

    @Column({ type: 'json', nullable: true })
    image: Image;

    @ManyToOne(() => Worker, (worker) => worker.actions, { nullable: true })
    worker: Worker;
}
