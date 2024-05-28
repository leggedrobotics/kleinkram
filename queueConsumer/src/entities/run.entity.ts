import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import QueueEntity from './queue.entity';
import Project from './project.entity';
import User from './user.entity';
import File from './file.entity';

@Entity()
export default class Run extends BaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Project, (project) => project.runs)
    project: Project;

    @OneToMany(() => File, (file) => file.run)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.run)
    queues: QueueEntity[];

    @ManyToOne(() => User, (user) => user.runs)
    creator: User;
}
