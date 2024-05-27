import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Run from './run.entity';
import User from './user.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column()
    name: string;
    @Column({ nullable: true })
    description: string;

    @OneToMany(() => Run, (run) => run.project)
    runs: Run[];

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;
}
