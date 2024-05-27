import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { TokenTypes } from '../../enum';
import Run from '../../run/entities/run.entity';
import AnalysisRun from '../../analysis/entities/analysis.entity';

@Entity()
export default class Token extends BaseEntity {
    @Column()
    @Generated('uuid')
    token: string;

    @Column()
    tokenType: TokenTypes;

    @ManyToOne(() => Run, (run) => run.tokens)
    run: Run;

    @OneToOne(() => AnalysisRun, (analysis) => analysis.token)
    analysis: AnalysisRun;
}
