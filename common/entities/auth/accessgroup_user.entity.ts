import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import AccessGroup from './accessgroup.entity';
import User from '../user/user.entity';

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
