import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import QueueEntity from './queue.entity';
import FileEntity from './file.entity';
import Project from './project.entity';

@Entity()
export default class Run extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => Project, (project) => project.runs)
  project: Project;

  @OneToMany(() => FileEntity, (file) => file.run)
  files: FileEntity[];

  @OneToMany(() => QueueEntity, (queue) => queue.run)
  queues: QueueEntity[];
}
