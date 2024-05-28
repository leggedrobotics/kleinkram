import { Column, Entity, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Run from '../../run/entities/run.entity';
import Token from '../../auth/entities/token.entity';
import { AnalysisState } from '../../enum';

export type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

@Entity()
export default class AnalysisRun extends BaseEntity {
    @Column()
    state: AnalysisState;

    @Column({ nullable: true })
    state_cause: string;

    @Column()
    docker_image: string;

    @ManyToOne(() => Run, (run) => run.files)
    run: Run;

    @Column({ type: 'json', nullable: true })
    logs: ContainerLog[];

    @OneToOne(() => Token, { cascade: true })
    @JoinColumn()
    token: Token;
}
