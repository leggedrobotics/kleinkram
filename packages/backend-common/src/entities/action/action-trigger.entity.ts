import type { TriggerConfig } from '@kleinkram/api-dto/types/actions/action-trigger.dto';
import { TriggerType } from '@kleinkram/shared';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base-entity.entity';
import { MissionEntity } from '../mission/mission.entity';
import { ProjectEntity } from '../project/project.entity';
import { UserEntity } from '../user/user.entity';
import { ActionTemplateEntity } from './action-template.entity';

@Entity({ name: 'action_trigger' })
export class ActionTriggerEntity extends BaseEntity {
    @Column()
    name!: string;

    @Column()
    description!: string;

    @ManyToOne(() => ActionTemplateEntity, { nullable: false })
    @JoinColumn({ name: 'templateUuid' })
    template!: ActionTemplateEntity;

    @Column()
    templateUuid!: string;

    @ManyToOne(() => MissionEntity, {
        nullable: true,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'missionUuid' })
    mission?: MissionEntity | null;

    @Column({ nullable: true })
    missionUuid?: string | null;

    @ManyToOne(() => ProjectEntity, {
        nullable: true,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'projectUuid' })
    project?: ProjectEntity | null;

    @Column({ nullable: true })
    projectUuid?: string | null;

    @Column({
        type: 'enum',
        enum: TriggerType,
    })
    type!: TriggerType;

    @Column({ type: 'json' })
    config!: TriggerConfig;

    @ManyToOne(() => UserEntity, (user) => user.triggers, { nullable: false })
    @JoinColumn({ name: 'creatorUuid' })
    creator!: UserEntity;

    @Column()
    creatorUuid!: string;
}
