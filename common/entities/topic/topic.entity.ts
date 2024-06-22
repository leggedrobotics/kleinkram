import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';

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

    @ManyToOne(() => FileEntity, (file) => file.topics)
    file: FileEntity;
}
