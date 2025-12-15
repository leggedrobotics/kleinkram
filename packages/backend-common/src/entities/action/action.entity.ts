import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { ApiKeyEntity } from '@backend-common/entities/auth/api-key.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { WorkerEntity } from '@backend-common/entities/worker/worker.entity';
import { RuntimeDescription } from '@backend-common/types';
import {
    ActionState,
    ArtifactState,
    ImageSource,
    LogType,
} from '@kleinkram/shared';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

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
    @Column({ type: 'enum', enum: ActionState })
    state!: ActionState;

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

    @Column({ type: 'json', nullable: true, select: false })
    logs?: ContainerLog[];

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
}
