import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import type { TriggerConfig } from '@kleinkram/api-dto/types/actions/action-trigger.dto';
import { TriggerType } from '@kleinkram/shared';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

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
}
