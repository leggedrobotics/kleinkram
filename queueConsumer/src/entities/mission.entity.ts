import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Project from './project.entity';
import QueueEntity from './queue.entity';
import User from './user.entity';
import Apikey from './apikey.entity';
import File from './file.entity';
import AccessGroup from './accessgroup.entity';

@Entity()
export default class Mission extends BaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Project, (project) => project.missions)
    project: Project;

    @OneToMany(() => File, (file) => file.mission)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.mission)
    queues: QueueEntity[];

    @ManyToOne(() => User, (user) => user.missions)
    creator: User;

    @OneToMany(() => Apikey, (token) => token.mission)
    tokens: Apikey[];

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.missions)
    accessGroups: AccessGroup[];
}
