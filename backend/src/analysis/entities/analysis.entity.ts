import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';

@Entity()
export default class AnalysisRun extends BaseEntity {
  @Column()
  state: string;

  @Column()
  docker_image: string;

  @ManyToOne(() => Run, (run) => run.files)
  run: Run;
}
