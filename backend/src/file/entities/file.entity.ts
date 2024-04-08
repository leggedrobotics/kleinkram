import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Topic from '../../topic/entities/topic.entity';
import Run from '../../run/entities/run.entity';

@Entity()
export default class File extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => Run, (project) => project.files)
  run: Run;

  @Column()
  date: Date;

  @ManyToMany(() => Topic, (topic) => topic.runs)
  @JoinTable()
  topics: Topic[];

  @Column()
  filename: string;

  @Column()
  size: number;
}
