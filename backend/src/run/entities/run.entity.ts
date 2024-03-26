import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Project from '../../project/entities/project.entity';
import Topic from '../../topic/entities/topic.entity';

@Entity()
export default class Run extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => Project, (project) => project.runs)
  project: Project;

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
