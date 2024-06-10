import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import User from './user.entity';
import Project from './project.entity';
import Mission from './mission.entity';
import { AccessGroupRights } from '../enum';
import BaseEntity from '../base-entity.entity';

@Entity()
export default class AccessGroup extends BaseEntity {
    @Column()
    name: string;

    @ManyToMany(() => User, (user) => user.accessGroups)
    @JoinTable()
    users: User[];

    @ManyToMany(() => Project, (project) => project.accessGroups)
    @JoinTable()
    projects: Project[];

    @ManyToMany(() => Mission, (mission) => mission.accessGroups)
    @JoinTable()
    missions: Mission[];

    @Column()
    rights: AccessGroupRights;

    @Column()
    personal: boolean;

    @Column({ default: false })
    inheriting: boolean;
}
