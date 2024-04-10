import { Column, Entity, JoinTable, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Run from './run.entity';
import Topic from './topic.entity';


@Entity()
export default class File extends BaseEntity {
  @Column()
  identifier: string;

  @ManyToOne(() => Run, (run) => run.files)
  run: Run;

  @Column()
  date: Date;

  @OneToMany(() => Topic, (topic) => topic.run, { cascade: ['remove'] })
  topics: Topic[];

  @Column()
  filename: string;

  @Column()
  size: number;
}
