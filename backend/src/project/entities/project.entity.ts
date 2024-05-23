import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';
import User from '../../user/entities/user.entity';

@Entity()
export default class Project extends BaseEntity {
  @Column()
  name: string;

  @OneToMany(() => Run, (run) => run.project)
  runs: Run[];

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User, (user) => user.projects)
  creator: User;
}
