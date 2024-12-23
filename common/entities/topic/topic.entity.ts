import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';
import { TopicDto } from '../../api/types/topic.dto';

@Entity()
export default class Topic extends BaseEntity {
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

    get topicDto(): TopicDto {
        return {
            name: this.name,
            type: this.type,
            nrMessages: this.nrMessages ?? 0n,
            frequency: Number.isNaN(this.frequency) ? 0 : this.frequency,
        };
    }
}
