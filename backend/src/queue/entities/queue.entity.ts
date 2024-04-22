import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { FileLocation, FileState } from '../../enum';
import Run from '../../run/entities/run.entity';

@Entity()
export default class QueueEntity extends BaseEntity {
  @Column()
  identifier: string;

  @Column()
  filename: string;

  @Column({
    type: 'enum',
    enum: FileState,
    default: 'PENDING',
  })
  state: FileState;

  @ManyToOne(() => Run, (project) => project.queues)
  run: Run;

  @Column({
    type: 'enum',
    enum: FileLocation,
    default: 'DRIVE',
  })
  location: FileLocation;
}
