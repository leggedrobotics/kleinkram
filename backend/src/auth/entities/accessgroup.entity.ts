import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import User from '../../user/entities/user.entity';
import Project from '../../project/entities/project.entity';
import Mission from '../../mission/entities/mission.entity';
import { AccessGroupRights } from '../../enum';

@Entity()
export default class AccessGroup extends BaseEntity {
    @Column()
    name: string;

    @ManyToMany(() => User, (user) => user.accessGroups, { cascade: true })
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
}
