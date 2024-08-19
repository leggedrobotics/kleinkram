import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import Apikey from '../auth/apikey.entity';
import { ActionState } from '../../enum';
import User from '../user/user.entity';
import { RuntimeCapability, RuntimeRequirements } from '../../types';

export type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export type Image = {
    name: string;
    sha: string | null;
    repo_digests: string[] | null;
};

export type RunnerInfo = {
    hostname: string;
    runtime_capabilities: RuntimeCapability;
};

export type Container = {
    id: string;
};

export interface SubmittedAction {
    uuid: string;
    state: ActionState;
    runtime_requirements: RuntimeRequirements;
    image: Image;
}

@Entity()
export default class Action extends BaseEntity implements SubmittedAction {
    @Column()
    state: ActionState;

    @Column({ type: 'json' })
    runtime_requirements: RuntimeRequirements;

    @Column({ type: 'json' })
    image: Image;

    @Column({ type: 'json', nullable: true })
    container: Container;

    @Column({ type: 'json', nullable: true })
    runner_info: RunnerInfo;

    @ManyToOne(() => User, (user) => user.submittedActions)
    createdBy: User;

    @Column({ nullable: true })
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

    @Column({ nullable: true })
    exit_code: number;

    @OneToOne(() => Apikey)
    @JoinColumn()
    key: Apikey;
}
