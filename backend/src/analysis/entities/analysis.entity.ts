import {Column, Entity} from 'typeorm';
import BaseEntity from '../../base-entity.entity';

@Entity()
export default class AnalysisRun extends BaseEntity {
    @Column()
    identifier: string;
}
