import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileVersionEntity } from '@backend-common/entities/file/file-version.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

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

    /**
     * Topics are extracted from the bytes of one concrete file version, so
     * they hang off {@link FileVersionEntity} rather than off the logical
     * file. Set `fileVersionUuid` explicitly when creating a topic.
     */
    @ManyToOne(
        () => FileVersionEntity,
        (fileVersion: FileVersionEntity) => fileVersion.topics,
        {
            onDelete: 'CASCADE',
        },
    )
    @JoinColumn({ name: 'fileVersionUuid' })
    fileVersion?: FileVersionEntity;

    @Column({ type: 'uuid', nullable: true })
    fileVersionUuid?: string;
}
