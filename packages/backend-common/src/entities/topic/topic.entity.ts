import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileVersionEntity } from '@backend-common/entities/file/file-version.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
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

    // Backwards-compatibility getter and setter
    get file(): FileEntity | undefined {
        return this.fileVersion?.file;
    }

    set file(f: FileEntity | undefined) {
        if (f) {
            this.fileVersion = f.activeVersion ?? f.versions?.[0];
            if (this.fileVersion) {
                this.fileVersionUuid = this.fileVersion.uuid;
            }
        }
    }
}
