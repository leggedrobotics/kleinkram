import { ActionDiagnosticEntity } from '@backend-common/entities/action/action-diagnostic.entity';
import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { ActionTriggerEntity } from '@backend-common/entities/action/action-trigger.entity';
import { ApiKeyEntity } from '@backend-common/entities/auth/api-key.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { WorkerEntity } from '@backend-common/entities/worker/worker.entity';
import { RuntimeDescription } from '@backend-common/types';
import {
    ActionErrorHint,
    ActionFailureOrigin,
    ActionSeverity,
    ActionState,
    ActionTriggerSource,
    ArtifactState,
    ImageSource,
    LogType,
    ResourceUsage,
} from '@kleinkram/shared';
import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
} from 'typeorm';

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

    // eslint-disable-next-line @typescript-eslint/naming-convention
    runtime_requirements: RuntimeDescription;
    image: Image;
    command: string;
}

@Entity({ name: 'action' })
export class ActionEntity extends BaseEntity {
    @Index()
    @Column({ type: 'enum', enum: ActionState })
    state!: ActionState;

    /**
     * The verdict of the run, orthogonal to {@link state}.
     *
     * `state` says whether the container reached the end; `severity` says what
     * it found. It is raised by diagnostics reported during the run and by an
     * exit code of 75, and never lowered.
     */
    @Index()
    @Column({
        type: 'enum',
        enum: ActionSeverity,
        nullable: false,
        default: ActionSeverity.OK,
    })
    severity!: ActionSeverity;

    /**
     * Who is responsible for a failure. Null unless {@link state} is `FAILED`,
     * and null for actions that ran before this was recorded.
     */
    @Index()
    @Column({ type: 'enum', enum: ActionFailureOrigin, nullable: true })
    failureOrigin?: ActionFailureOrigin;

    @OneToMany(() => ActionDiagnosticEntity, (diagnostic) => diagnostic.action)
    diagnostics?: ActionDiagnosticEntity[];

    /**
     * Number of distinct diagnostics stored for this action.
     *
     * Denormalised so that the action list can show "3 warnings" without
     * joining the diagnostics table for every row.
     */
    @Column({ type: 'int', nullable: false, default: 0 })
    diagnosticCount!: number;

    /**
     * True when the action reported more distinct diagnostics than are kept
     * and later ones were dropped.
     */
    @Column({ type: 'boolean', nullable: false, default: false })
    diagnosticsTruncated!: boolean;

    @Column({ type: 'json', nullable: true })
    container?: Container;

    @ManyToOne(() => UserEntity, (user: UserEntity) => user.submittedActions, {
        nullable: false,
    })
    creator?: UserEntity;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    state_cause?: string;

    @Column({ nullable: true })
    executionStartedAt?: Date;

    @Column({ nullable: true })
    executionEndedAt?: Date;

    @Column({ nullable: true })
    actionContainerStartedAt?: Date;

    @Column({ nullable: true })
    actionContainerExitedAt?: Date;

    @ManyToOne(() => MissionEntity, (mission) => mission.actions, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    mission?: MissionEntity;

    @Column({ type: 'json', nullable: true, default: [] })
    auditLogs?: unknown[];

    @Column({ nullable: true })

    // eslint-disable-next-line @typescript-eslint/naming-convention
    exit_code?: number;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    artifact_path?: string;

    @Column({
        type: 'enum',
        enum: ArtifactState,
        nullable: false,
        default: ArtifactState.AWAITING_ACTION,
    })
    artifacts!: ArtifactState;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    artifact_size?: number;

    @Column({ type: 'json', nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    artifact_files?: string[];

    @Column({ nullable: true })
    artifactExpirationDate?: Date;

    @OneToOne(() => ApiKeyEntity, (apikey) => apikey.action)
    @JoinColumn()
    key?: ApiKeyEntity;

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

    @Column({
        type: 'enum',
        enum: ActionTriggerSource,
        default: ActionTriggerSource.MANUAL,
    })
    triggerSource!: ActionTriggerSource;

    @ManyToOne(() => ActionTriggerEntity, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'triggerUuid' })
    trigger?: ActionTriggerEntity;

    @Column({ nullable: true })
    triggerUuid?: string;

    @Column({
        type: 'enum',
        enum: ActionErrorHint,
        nullable: true,
    })
    errorHint?: ActionErrorHint;

    @Column({ type: 'json', nullable: true })
    resourceUsage?: ResourceUsage;

    @Column({ type: 'bigint', nullable: true })
    maxMemoryBytes?: number;

    @Column({ type: 'float', nullable: true })
    avgCpuPercent?: number;

    @Column({ type: 'float', nullable: true })
    efficiencyScore?: number;
}
