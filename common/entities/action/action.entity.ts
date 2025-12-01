import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import {
    ActionState,
    ArtifactState,
    ImageSource,
    LogType,
} from '../../frontend_shared/enum';
import { RuntimeDescription } from '../../types';
import ApikeyEntity from '../auth/apikey.entity';
import BaseEntity from '../base-entity.entity';
import MissionEntity from '../mission/mission.entity';
import UserEntity from '../user/user.entity';
import WorkerEntity from '../worker/worker.entity';
import ActionTemplateEntity from './action-template.entity';

export interface ContainerLog {
    timestamp: string;
    message: string;
    type: LogType;
}

export interface Image {
    sha: string | null;
    repoDigests: string[] | null;
    source?: ImageSource;
    localCreatedAt?: Date | undefined;
    remoteCreatedAt?: Date | undefined;
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

@Entity({ name: 'action' })
export default class ActionEntity extends BaseEntity {
    @Column()
    state!: ActionState;

    @Column({ type: 'json', nullable: true })
    container?: Container;

    @ManyToOne(() => UserEntity, (user) => user.submittedActions, {
        nullable: false,
    })
    creator?: UserEntity;

    @Column({ nullable: true })
    state_cause?: string;

    @Column({ nullable: true })
    executionStartedAt?: Date;

    @Column({ nullable: true })
    executionEndedAt?: Date;

    @ManyToOne(() => MissionEntity, (mission) => mission.actions, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    mission?: MissionEntity;

    @Column({ type: 'json', nullable: true, select: false })
    logs?: ContainerLog[];

    @Column({ type: 'json', nullable: true, default: [] })
    auditLogs?: any[];

    @Column({ nullable: true })
    exit_code?: number;

    @Column({ nullable: true })
    artifact_path?: string;

    @Column({ nullable: false, default: ArtifactState.AWAITING_ACTION })
    artifacts!: ArtifactState;

    @Column({ nullable: true })
    artifact_size?: number;

    @Column({ type: 'json', nullable: true })
    artifact_files?: string[];

    @OneToOne(() => ApikeyEntity, (apikey) => apikey.action)
    @JoinColumn()
    key?: ApikeyEntity;

    @ManyToOne(
        () => ActionTemplateEntity,
        (actionTemplate) => actionTemplate.actions,
        { nullable: false },
    )
    template?: ActionTemplateEntity;

    @Column({ type: 'json', nullable: true })
    image?: Image;

    @ManyToOne(() => WorkerEntity, (worker) => worker.actions, {
        nullable: true,
    })
    worker?: WorkerEntity;
}
