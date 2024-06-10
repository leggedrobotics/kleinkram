import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
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
    users: User[];

    @ManyToMany(() => Project, (project) => project.accessGroups)
    projects: Project[];

    @ManyToMany(() => Mission, (mission) => mission.accessGroups)
    missions: Mission[];

    @Column()
    rights: AccessGroupRights;
}
