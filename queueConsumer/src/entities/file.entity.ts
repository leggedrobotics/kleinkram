import { Column, Entity, JoinTable, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Run from './run.entity';
import Topic from './topic.entity';
import User from "./user.entity";


@Entity()
export default class File extends BaseEntity {

  @ManyToOne(() => Run, (run) => run.files)
  run: Run;

  @Column()
  date: Date;

  @OneToMany(() => Topic, (topic) => topic.run, { cascade: ['remove'] })
  topics: Topic[];

  @Column()
  filename: string;

  @Column({ type: 'bigint' })
  size: number;

  @ManyToOne(() => User, (user) => user.files)
  creator: User;
}
