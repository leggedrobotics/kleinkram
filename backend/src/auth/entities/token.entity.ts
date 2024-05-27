import { Column, Entity, Generated, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { TokenTypes } from '../../enum';
import Run from '../../run/entities/run.entity';

@Entity()
export default class Token extends BaseEntity {
    @Column()
    @Generated('uuid')
    token: string;

    @Column()
    tokenType: TokenTypes;

    @ManyToOne(() => Run, (run) => run.tokens)
    run: Run;
}
