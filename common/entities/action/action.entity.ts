import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import Apikey from '../auth/apikey.entity';
import { ActionState, ArtifactState } from '../../frontend_shared/enum';
import User from '../user/user.entity';
import ActionTemplate from './action-template.entity';
import Worker from '../worker/worker.entity';
import { RuntimeDescription } from '../../types';
import { ActionDto } from '../../api/types/actions/action.dto';
import { DockerImageDto } from '../../api/types/actions/docker-image.dto';
import { AuditLogDto } from '../../api/types/actions/audit-log.dto';
import { ActionWorkerDto } from '../../api/types/action-workers.dto';
import { LogsDto } from '../../api/types/actions/logs.dto';

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

    get actionDto(): ActionDto {
        return actionEntityToDto(this);
    }
}

export const actionEntityToDto = (action: Action): ActionDto => {
    if (action.createdBy === undefined) {
        throw new Error('Action must have a creator');
    }

    if (action.mission === undefined) {
        throw new Error('Action must have a mission');
    }

    if (action.template === undefined) {
        throw new Error('Action must have a template');
    }

    return {
        artifactUrl: action.artifact_url ?? '',
        artifacts: action.artifacts,
        auditLogs: (action.auditLogs as unknown as AuditLogDto[]) ?? [],
        createdAt: action.createdAt,
        creator: action.createdBy.userDto,
        image: (action.image as DockerImageDto) ?? { repoDigests: [] },
        logs: (action.logs as unknown as LogsDto[]) ?? [],
        mission: action.mission.missionDto,
        state: action.state,
        stateCause: action.state_cause ?? '',
        template: action.template.actionTemplateDto,
        updatedAt: action.updatedAt,
        uuid: action.uuid,
        worker: action.worker as ActionWorkerDto,
    };
};
