import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { MissionAccessEntity } from '@backend-common/entities/auth/mission-access.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupType } from '@kleinkram/shared';
import {
    Column,
    Entity,
    JoinTable,
    ManyToOne,
    OneToMany,
    Unique,
} from 'typeorm';

@Unique('unique_access_group_name', ['name'])
@Entity({ name: 'access_group' })
export class AccessGroupEntity extends BaseEntity {
    @Column()
    name!: string;

    @OneToMany(
        () => GroupMembershipEntity,
        (membership) => membership.accessGroup,
        {
            cascade: true,
        },
    )
    memberships?: GroupMembershipEntity[];

    @OneToMany(
        () => ProjectAccessEntity,
        (projectAccess) => projectAccess.accessGroup,
    )

    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_accesses?: ProjectAccessEntity[];

    @OneToMany(
        () => MissionAccessEntity,
        (missionAccess) => missionAccess.accessGroup,
    )
    @JoinTable()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    mission_accesses?: MissionAccessEntity[];

    @Column({
        type: 'enum',
        enum: AccessGroupType,
        default: AccessGroupType.CUSTOM,
    })
    type!: AccessGroupType;

    @ManyToOne(() => UserEntity, (user) => user.files, { nullable: true })
    creator?: UserEntity;

    /**
     * A hidden access group is not returned in any search queries.
     * Hidden access groups may still be accessed by referenced by UUID
     * (e.g., when listing groups with access to a project).
     *
     */
    @Column({ default: false })
    hidden!: boolean;
}
