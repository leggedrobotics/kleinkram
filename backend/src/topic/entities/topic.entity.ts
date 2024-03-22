import { Column, Entity, ManyToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';

@Entity()
export default class Topic extends BaseEntity {
  @Column()
  name: string;

  @Column()
  type: string;

  @Column('bigint')
  nrMessages: bigint;

  @Column('float')
  frequency: number;

  @ManyToMany(() => Run)
  runs: Run[];
}
