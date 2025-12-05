import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity({ name: 'topic' })
export class TopicEntity extends BaseEntity {
    @Column()
    name!: string;

    @Column()
    type!: string;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number.parseInt(value, 10),
        },
    })
    nrMessages?: bigint;

    @Column({
        default: '',
    })
    messageEncoding!: string;

    @Column('float')
    frequency!: number;

    @ManyToOne(() => FileEntity, (file) => file.topics, { onDelete: 'CASCADE' })
    file?: FileEntity;
}
