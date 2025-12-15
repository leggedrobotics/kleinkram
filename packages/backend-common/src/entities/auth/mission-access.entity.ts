import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { AccessGroupEntity } from './access-group.entity';

import { AccessGroupRights } from '@kleinkram/shared';

@Entity({ name: 'mission_access' })
@Unique('no_duplicated_access_groups_per_mission', ['accessGroup', 'mission'])
export class MissionAccessEntity extends BaseEntity {
    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroupEntity, (group) => group.mission_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => MissionEntity, (mission) => mission.mission_accesses, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;
}
