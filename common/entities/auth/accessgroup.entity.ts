import {
    Column,
    Entity,
    JoinTable,
    ManyToOne,
    OneToMany,
    Unique,
} from 'typeorm';
import { AccessGroupType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';
import GroupMembership from './group-membership.entity';
import MissionAccess from './mission-access.entity';
import ProjectAccess from './project-access.entity';

@Unique('unique_access_group_name', ['name'])
@Entity()
export default class AccessGroup extends BaseEntity {
    @Column()
    name!: string;

    @OneToMany(() => GroupMembership, (membership) => membership.accessGroup, {
        cascade: true,
    })
    memberships?: GroupMembership[];

    @OneToMany(
        () => ProjectAccess,
        (projectAccess) => projectAccess.accessGroup,
    )
    project_accesses?: ProjectAccess[];

    @OneToMany(
        () => MissionAccess,
        (missionAccess) => missionAccess.accessGroup,
    )
    @JoinTable()
    mission_accesses?: MissionAccess[];

    @Column({
        type: 'enum',
        enum: AccessGroupType,
        default: AccessGroupType.CUSTOM,
    })
    type!: AccessGroupType;

    @ManyToOne(() => User, (user) => user.files, { nullable: true })
    creator?: User;

    /**
     * A hidden access group is not returned in any search queries.
     * Hidden access groups may still be accessed by referenced by UUID
     * (e.g., when listing groups with access to a project).
     *
     */
    @Column({ default: false })
    hidden!: boolean;
}
