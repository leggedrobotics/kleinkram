import { Column, Entity, ManyToMany, ManyToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import File from '../../file/entities/file.entity';

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

    @ManyToOne(() => File, (file) => file.topics)
    run: File;
}
