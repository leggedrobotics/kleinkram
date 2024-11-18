import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { AccessGroupRights } from '../../enum';
import AccessGroup from './accessgroup.entity';
import Mission from '../mission/mission.entity';

@Entity()
@Unique('no_duplicated_access_groups_per_mission', ['accessGroup', 'mission'])
export default class MissionAccess extends BaseEntity {
    @Column()
    rights: AccessGroupRights;

    @ManyToOne(() => AccessGroup, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup: AccessGroup;

    @ManyToOne(() => Mission, (mission) => mission.mission_accesses, {
        nullable: false,
    })
    mission: Mission;
}
