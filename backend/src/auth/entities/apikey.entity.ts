import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { KeyTypes } from '../../enum';
import Run from '../../run/entities/run.entity';
import AnalysisRun from '../../analysis/entities/analysis.entity';

@Entity()
export default class Apikey extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey: string;

    @Column()
    apikeytype: KeyTypes;

    @ManyToOne(() => Run, (run) => run.tokens)
    run: Run;

    @OneToOne(() => AnalysisRun)
    analysis: AnalysisRun;
}
