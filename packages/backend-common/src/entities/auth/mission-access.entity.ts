import AccessGroupEntity from '@backend-common/entities/auth/accessgroup.entity';
import BaseEntity from '@backend-common/entities/base-entity.entity';
import MissionEntity from '@backend-common/entities/mission/mission.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';

import { AccessGroupRights } from '@kleinkram/shared';

@Entity({ name: 'mission_access' })
@Unique('no_duplicated_access_groups_per_mission', ['accessGroup', 'mission'])
export default class MissionAccessEntity extends BaseEntity {
    @Column()
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroupEntity, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => MissionEntity, (mission) => mission.mission_accesses, {
        nullable: false,
    })
    mission?: MissionEntity;
}
