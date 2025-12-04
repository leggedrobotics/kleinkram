import AccessGroupEntity from '@backend-common/entities/auth/accessgroup.entity';
import BaseEntity from '@backend-common/entities/base-entity.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';

@Unique('no_duplicated_user_in_access_group', ['accessGroup', 'user'])
@Entity({ name: 'group_membership' })
export default class GroupMembershipEntity extends BaseEntity {
    @ManyToOne(() => AccessGroupEntity, (group) => group.project_accesses, {
        onDelete: 'CASCADE',
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => UserEntity, (user) => user.memberships, {
        onDelete: 'CASCADE',
    })
    user?: UserEntity;

    /**
     * The expiration date of the group membership.
     *
     * If the expiration data is set, the user will be treated as if
     * they were not part of the group after the expiration date.
     *
     * If the expiration date is not set, the user will be treated as
     * part of the group indefinitely.
     *
     */
    @Column({ nullable: true, default: null })
    expirationDate?: Date;

    /**
     * If the user is a group admin, they can manage the group.
     * Group admins can add and remove users from the group.
     *
     */
    @Column({ default: false })
    canEditGroup!: boolean;
}
