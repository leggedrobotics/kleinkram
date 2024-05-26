import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';

export type ContainerLog = {
  timestamp: string,
  message: string,
  type: 'stdout' | 'stderr'

}

@Entity()
export default class AnalysisRun extends BaseEntity {
  @Column()
  state: string;

  @Column({nullable: true})
  state_cause: string;

  @Column()
  docker_image: string;

  @ManyToOne(() => Run, (run) => run.files)
  run: Run;

  @Column({type: 'json', nullable: true})
  logs: ContainerLog[];
}
