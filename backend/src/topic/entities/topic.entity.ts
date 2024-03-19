import { Column, Entity, ManyToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';

@Entity()
export default class Topic extends BaseEntity {
  @Column()
  name: string;

  @ManyToMany(() => Run)
  runs: Run[];
}
