import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Project from '../../project/entities/project.entity';
import File from '../../file/entities/file.entity';
import QueueEntity from '../../queue/entities/queue.entity';

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
}
