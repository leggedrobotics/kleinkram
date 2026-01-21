import type { TriggerConfig } from '@kleinkram/api-dto/types/actions/action-trigger.dto';
import { TriggerType } from '@kleinkram/shared';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base-entity.entity';
import { MissionEntity } from '../mission/mission.entity';
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

    @ManyToOne(() => MissionEntity, { nullable: false })
    @JoinColumn({ name: 'missionUuid' })
    mission!: MissionEntity;

    @Column()
    missionUuid!: string;

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
