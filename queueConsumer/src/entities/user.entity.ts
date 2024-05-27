import { Column, Entity, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Project from './project.entity';
import QueueEntity from './queue.entity';
import Run from './run.entity';
import File from './file.entity';
import { UserRole } from 'src/enum';

@Entity()
export default class User extends BaseEntity {
    @Column()
    name: string;

    @Column()
    email: string;

    @Column()
    role: UserRole;

    @Column()
    googleId: string;

    @OneToMany(() => Project, (project) => project.creator)
    projects: Project[];

    @OneToMany(() => Run, (run) => run.creator)
    runs: Run[];

    @OneToMany(() => File, (file) => file.creator)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.creator)
    queues: QueueEntity[];
}
