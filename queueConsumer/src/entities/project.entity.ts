import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from './mission.entity';
import User from './user.entity';
import AccessGroup from './accessgroup.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column()
    name: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions: Mission[];

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.projects)
    accessGroups: AccessGroup[];

    @Column({ nullable: true })
    description: string;

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;
}
