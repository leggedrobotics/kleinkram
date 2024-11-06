import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { AccessGroupRights } from '../../enum';
import AccessGroup from './accessgroup.entity';
import Mission from '../mission/mission.entity';

@Entity()
@Unique(['accessGroup', 'mission'])
export default class MissionAccess extends BaseEntity {
    @Column()
    rights: AccessGroupRights;

    @ManyToOne(() => AccessGroup, (group) => group.project_accesses)
    accessGroup: AccessGroup;

    @ManyToOne(() => Mission, (mission) => mission.mission_accesses)
    mission: Mission;
}
