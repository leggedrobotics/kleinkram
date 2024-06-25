import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';
import Project from '../project/project.entity';
import Mission from '../mission/mission.entity';
import { AccessGroupRights } from '../../enum';

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
