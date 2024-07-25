import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';
import ProjectAccess from './project_access.entity';
import MissionAccess from './mission_access.entity';

@Entity()
export default class AccessGroup extends BaseEntity {
    @Column()
    name: string;

    @ManyToMany(() => User, (user) => user.accessGroups)
    @JoinTable()
    users: User[];

    @OneToMany(
        () => ProjectAccess,
        (project_access) => project_access.accessGroup,
    )
    project_accesses: ProjectAccess[];

    @OneToMany(
        () => MissionAccess,
        (mission_access) => mission_access.accessGroup,
    )
    @JoinTable()
    mission_accesses: MissionAccess[];

    @Column()
    personal: boolean;

    @Column({ default: false })
    inheriting: boolean;
}
