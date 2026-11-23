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

    /**
     * Messages per second between {@link firstSeen} and {@link lastSeen}, not
     * over the whole recording. Null when the topic has no rate: a single
     * message, a zero span, no message counts, or a one-shot topic (fewer than
     * five chunks, in a file of at least five).
     * Where the per-topic span is unknown (db3, MCAPs without message indexes,
     * files not yet backfilled) it is still the message count over the whole
     * recording.
     */
    @Column({ type: 'float', nullable: true })
    frequency!: number | null;

    /**
     * Start of the first chunk that holds the topic. Accurate to one chunk;
     * null while unknown (see {@link FileEntity.topicStatsVersion}).
     */
    @Column({ type: 'timestamptz', nullable: true })
    firstSeen?: Date | null;

    /** End of the last chunk that holds the topic, null while unknown. */
    @Column({ type: 'timestamptz', nullable: true })
    lastSeen?: Date | null;

    /** Chunks with at least one message of the topic, null while unknown. */
    @Column({ type: 'int', nullable: true })
    chunkCount?: number | null;

    /**
     * Where the topic has data, as `[startMs, endMs]` spans in milliseconds
     * since the file's recording start. Null while unknown.
     */
    @Column({ type: 'jsonb', nullable: true })
    coverage?: [number, number][] | null;

    @ManyToOne(() => FileEntity, (file: FileEntity) => file.topics, {
        onDelete: 'CASCADE',
    })
    file?: FileEntity;
}
