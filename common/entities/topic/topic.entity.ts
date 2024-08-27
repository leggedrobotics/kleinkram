import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';

@Entity()
export default class Topic extends BaseEntity {
    @Column()
    name: string;

    @Column()
    type: string;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => parseInt(value, 10),
        },
    })
    nrMessages: bigint;

    @Column('float')
    frequency: number;

    @ManyToOne(() => FileEntity, (file) => file.topics, { onDelete: 'CASCADE' })
    file: FileEntity;
}
