import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import AccessGroup from './accessgroup.entity';
import User from '../user/user.entity';

@Unique('no_duplicated_user_in_access_group', ['accessGroup', 'user'])
@Entity()
export default class GroupMembership extends BaseEntity {
    @ManyToOne(() => AccessGroup, (group) => group.project_accesses, {
        onDelete: 'CASCADE',
    })
    accessGroup: AccessGroup;

    @ManyToOne(() => User, (user) => user.memberships, {
        onDelete: 'CASCADE',
    })
    user: User;

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
    expirationDate: Date;

    /**
     * If the user is a group admin, they can manage the group.
     * Group admins can add and remove users from the group.
     *
     */
    @Column({ default: false })
    isGroupAdmin: boolean;
}
