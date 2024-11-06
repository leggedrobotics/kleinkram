import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import AccessGroup from './accessgroup.entity';
import User from '../user/user.entity';

@Unique(['accessGroup', 'user'])
@Entity()
export default class AccessGroupUser extends BaseEntity {
    @ManyToOne(() => AccessGroup, (group) => group.project_accesses, {
        onDelete: 'CASCADE',
    })
    accessGroup: AccessGroup;

    @ManyToOne(() => User, (user) => user.accessGroupUsers)
    user: User;

    @Column({ nullable: true })
    expirationDate: Date;
}
